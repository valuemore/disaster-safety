-- 재난안전MVP 초기 스키마
-- Supabase PostgreSQL (Postgres 15+)
-- 개인정보 원칙: 이름·진단명·약물명·보호자 연락처 컬럼 없음. 취약유아 정보는 숫자 집계값만.

-- ─────────────────────────────────────────────────────────────
-- 유틸: updated_at 자동 갱신 트리거 함수
-- ─────────────────────────────────────────────────────────────
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- 1. institutions — 기관 기본정보
-- ─────────────────────────────────────────────────────────────
create table if not exists institutions (
  id                   uuid primary key default gen_random_uuid(),
  name                 text not null,
  type                 text not null check (type in ('daycare', 'kindergarten')),
  address              text,
  latitude             numeric(9, 6),
  longitude            numeric(9, 6),
  sido                 text,
  sigungu              text,
  dong                 text,
  total_children       int,
  infant_count         int,
  toddler_count        int,
  staff_count          int,
  has_shuttle          boolean not null default false,
  has_outdoor_playground boolean not null default false,
  cooling_space_count  int not null default 0,
  water_available      boolean not null default false,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists idx_institutions_sido_sigungu on institutions (sido, sigungu);
create index if not exists idx_institutions_type on institutions (type);
create index if not exists idx_institutions_created_at on institutions (created_at desc);

create trigger trg_institutions_updated_at
  before update on institutions
  for each row execute function set_updated_at();

-- ─────────────────────────────────────────────────────────────
-- 2. heatwave_profiles — 폭염 대응 프로필 (집계값만)
-- ─────────────────────────────────────────────────────────────
create table if not exists heatwave_profiles (
  id                        uuid primary key default gen_random_uuid(),
  institution_id            uuid not null references institutions (id) on delete cascade,
  heat_vulnerable_count     int not null default 0,
  respiratory_caution_count int not null default 0,
  mobility_support_count    int not null default 0,
  special_support_count     int not null default 0,
  cooling_ok                boolean not null default true,
  indoor_alt_space          boolean not null default false,
  water_supply_ok           boolean not null default false,
  thermometer               boolean not null default false,
  first_aid_kit             boolean not null default false,
  vehicle_thermometer       boolean not null default false,
  pickup_wait_place         text check (pickup_wait_place in ('indoor', 'shade', 'outdoor', 'etc')),
  is_current                boolean not null default true,
  created_at                timestamptz not null default now()
);

create index if not exists idx_heatwave_profiles_institution on heatwave_profiles (institution_id);
create index if not exists idx_heatwave_profiles_current on heatwave_profiles (institution_id) where is_current;

-- 새 프로필 INSERT 시 동일 기관의 기존 is_current를 false로
create or replace function set_profile_is_current()
returns trigger language plpgsql as $$
begin
  update heatwave_profiles
  set is_current = false
  where institution_id = new.institution_id
    and id <> new.id
    and is_current = true;
  return new;
end;
$$;

create trigger trg_heatwave_profiles_is_current
  after insert on heatwave_profiles
  for each row execute function set_profile_is_current();

-- ─────────────────────────────────────────────────────────────
-- 3. disaster_messages — 재난문자
-- ─────────────────────────────────────────────────────────────
create table if not exists disaster_messages (
  id             uuid primary key default gen_random_uuid(),
  institution_id uuid references institutions (id) on delete cascade,
  disaster_type  text not null default 'heatwave',
  source         text not null check (source in ('sample', 'manual', 'api')),
  raw_text       text not null,
  summary        text,
  issued_at      timestamptz,
  received_at    timestamptz not null default now(),
  created_at     timestamptz not null default now()
);

create index if not exists idx_disaster_messages_institution on disaster_messages (institution_id);
create index if not exists idx_disaster_messages_source on disaster_messages (source);
create index if not exists idx_disaster_messages_type on disaster_messages (disaster_type);

-- ─────────────────────────────────────────────────────────────
-- 4. action_requests — 대응계획 생성 요청·결과
-- ─────────────────────────────────────────────────────────────
create table if not exists action_requests (
  id                   uuid primary key default gen_random_uuid(),
  institution_id       uuid not null references institutions (id) on delete cascade,
  disaster_message_id  uuid references disaster_messages (id) on delete set null,
  heatwave_profile_id  uuid references heatwave_profiles (id) on delete set null,
  selected_situations  text[],
  situation_etc        text,
  priority             text check (priority in ('high', 'medium', 'low')),
  result_json          jsonb not null,
  is_fallback          boolean not null default false,
  model                text,
  created_by_role      text check (created_by_role in ('admin', 'director', 'teacher', 'shuttle')),
  created_at           timestamptz not null default now()
);

create index if not exists idx_action_requests_institution_time on action_requests (institution_id, created_at desc);
create index if not exists idx_action_requests_priority on action_requests (priority);
create index if not exists idx_action_requests_created_at on action_requests (created_at desc);

-- ─────────────────────────────────────────────────────────────
-- 5. checklist_items — 역할별 체크리스트 항목
-- ─────────────────────────────────────────────────────────────
create table if not exists checklist_items (
  id                uuid primary key default gen_random_uuid(),
  action_request_id uuid not null references action_requests (id) on delete cascade,
  role              text not null check (role in ('director', 'teacher', 'shuttle')),
  sort_order        int not null default 0,
  content           text not null,
  is_done           boolean not null default false,
  done_at           timestamptz,
  created_at        timestamptz not null default now()
);

create index if not exists idx_checklist_items_request_role on checklist_items (action_request_id, role, sort_order);

-- ─────────────────────────────────────────────────────────────
-- 6. after_action_records — 사후기록
-- ─────────────────────────────────────────────────────────────
create table if not exists after_action_records (
  id                  uuid primary key default gen_random_uuid(),
  action_request_id   uuid not null references action_requests (id) on delete cascade,
  institution_id      uuid not null references institutions (id) on delete cascade,
  message_checked_at  timestamptz,
  outdoor_adjusted    boolean,
  cooling_checked     boolean,
  child_health_issue  boolean,
  parents_notified    boolean,
  shuttle_checked     boolean,
  completed_by        text,
  notes               text,
  improvement         text,
  created_at          timestamptz not null default now()
);

create index if not exists idx_after_action_records_institution on after_action_records (institution_id, created_at desc);
create index if not exists idx_after_action_records_request on after_action_records (action_request_id);

-- ─────────────────────────────────────────────────────────────
-- RLS: 테이블별 Row Level Security 활성화
-- anon에 SELECT만 허용 / INSERT·UPDATE·DELETE는 서버 service_role 전용
-- ─────────────────────────────────────────────────────────────
alter table institutions          enable row level security;
alter table heatwave_profiles     enable row level security;
alter table disaster_messages     enable row level security;
alter table action_requests       enable row level security;
alter table checklist_items       enable row level security;
alter table after_action_records  enable row level security;

-- institutions: 공개 읽기(데모용)
create policy "institutions_anon_select"
  on institutions for select to anon using (true);

-- disaster_messages: 공개 읽기
create policy "disaster_messages_anon_select"
  on disaster_messages for select to anon using (true);

-- action_requests: 공개 읽기
create policy "action_requests_anon_select"
  on action_requests for select to anon using (true);

-- checklist_items: 공개 읽기
create policy "checklist_items_anon_select"
  on checklist_items for select to anon using (true);

-- checklist_items: 체크 토글(anon UPDATE, is_done·done_at만)
create policy "checklist_items_anon_update_toggle"
  on checklist_items for update to anon
  using (true)
  with check (true);

-- heatwave_profiles: 서버 라우트 전용(anon SELECT 제한)
create policy "heatwave_profiles_anon_select"
  on heatwave_profiles for select to anon using (true);

-- after_action_records: 서버 라우트 전용(anon SELECT 제한)
create policy "after_action_records_anon_select"
  on after_action_records for select to anon using (true);
