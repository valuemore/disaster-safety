-- 0002_disaster_expansion.sql
-- 재난유형 확장 마이그레이션 (폭염 무중단 보장)
-- PostgreSQL 15+  / Supabase
-- 멱등(재실행 안전): if not exists / do-block 패턴 사용
-- 개인정보 원칙: 이름·진단명·약물명·연락처 컬럼 없음. 취약유아는 집계값만.
-- !! 원격 DB에 적용하지 말 것 — 사용자 확인 후 별도 실행 !!

-- ─────────────────────────────────────────────────────────────
-- (a) disaster_messages.disaster_type CHECK 제약 추가
--     기존 행이 모두 'heatwave'이므로 데이터 안전
--     제약명 충돌 방지: DO-block으로 존재 여부 확인 후 ADD
-- ─────────────────────────────────────────────────────────────
do $$
begin
  if not exists (
    select 1
    from   pg_constraint
    where  conname = 'chk_disaster_messages_type'
      and  conrelid = 'disaster_messages'::regclass
  ) then
    alter table disaster_messages
      add constraint chk_disaster_messages_type
      check (disaster_type in ('heatwave', 'heavy_rain', 'infection'));
  end if;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- (b) institution_risk_profiles — 재난유형 범용 프로필 테이블
-- ─────────────────────────────────────────────────────────────
create table if not exists institution_risk_profiles (
  id               uuid        primary key default gen_random_uuid(),
  institution_id   uuid        not null references institutions (id) on delete cascade,
  disaster_type    text        not null check (disaster_type in ('heatwave', 'heavy_rain', 'infection')),
  -- 공통 위험대응 컬럼 (모든 재난유형 공유)
  thermometer      boolean     not null default false,
  first_aid_kit    boolean     not null default false,
  indoor_alt_space boolean     not null default false,
  -- 유형별 특수 필드 (폭염: heat_vulnerable_count 등, 집중호우: 저지대 여부 등, 감염병: 보건실 여부 등)
  disaster_specific jsonb      not null default '{}'::jsonb,
  is_current       boolean     not null default true,
  created_at       timestamptz not null default now()
);

-- 복합 조회 인덱스
create index if not exists idx_risk_profiles_inst_type
  on institution_risk_profiles (institution_id, disaster_type);

-- 유효 프로필 부분 인덱스 (is_current=true인 행만)
create index if not exists idx_risk_profiles_inst_type_current
  on institution_risk_profiles (institution_id, disaster_type)
  where is_current = true;

-- 트리거 함수: 동일 (institution_id, disaster_type) 신규 INSERT 시 기존 is_current=false
create or replace function set_risk_profile_is_current()
returns trigger language plpgsql as $$
begin
  update institution_risk_profiles
  set    is_current = false
  where  institution_id = new.institution_id
    and  disaster_type  = new.disaster_type
    and  id             <> new.id
    and  is_current     = true;
  return new;
end;
$$;

-- 트리거 등록 (멱등: 존재 시 먼저 드롭)
drop trigger if exists trg_risk_profiles_is_current on institution_risk_profiles;
create trigger trg_risk_profiles_is_current
  after insert on institution_risk_profiles
  for each row execute function set_risk_profile_is_current();

-- RLS
alter table institution_risk_profiles enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where  policyname = 'institution_risk_profiles_anon_select'
      and  tablename  = 'institution_risk_profiles'
  ) then
    create policy "institution_risk_profiles_anon_select"
      on institution_risk_profiles for select to anon using (true);
  end if;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- (c) institutions.staff_profile JSONB 컬럼 추가
--     급식·보건 인력 정보용 (역할 자동활성화 기반)
--     키 목록(계획 §3c): meal_count_per_serving, has_food_service_staff,
--       food_service_staff_count, has_cook_license_staff,
--       has_collective_food_service, has_health_staff,
--       health_staff_type, health_staff_count,
--       has_nurse_or_nursing_assistant, has_health_teacher,
--       has_designated_health_manager, kindergarten_class_count
-- ─────────────────────────────────────────────────────────────
do $$
begin
  if not exists (
    select 1
    from   information_schema.columns
    where  table_name  = 'institutions'
      and  column_name = 'staff_profile'
  ) then
    alter table institutions
      add column staff_profile jsonb not null default '{}'::jsonb;
  end if;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- (d) checklist_items.role CHECK 제약 확장
--     기존: ('director','teacher','shuttle')
--     신규: + 'cook_or_food_service', 'health_manager'
--     기존 제약명 checklist_items_role_check를 DROP 후 재생성 (멱등)
-- ─────────────────────────────────────────────────────────────
do $$
begin
  -- 기존 제약 제거
  if exists (
    select 1
    from   pg_constraint
    where  conname    = 'checklist_items_role_check'
      and  conrelid   = 'checklist_items'::regclass
  ) then
    alter table checklist_items
      drop constraint checklist_items_role_check;
  end if;

  -- 확장된 제약 추가
  if not exists (
    select 1
    from   pg_constraint
    where  conname    = 'checklist_items_role_check'
      and  conrelid   = 'checklist_items'::regclass
  ) then
    alter table checklist_items
      add constraint checklist_items_role_check
      check (role in ('director', 'teacher', 'shuttle', 'cook_or_food_service', 'health_manager'));
  end if;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- (e) action_requests: risk_profile_id 신규 컬럼 추가
--     heatwave_profile_id는 유지(deprecated — P8 안정화 후 제거 검토)
--     rename 대신 신규 컬럼 추가 → 무중단 안전
-- ─────────────────────────────────────────────────────────────
do $$
begin
  if not exists (
    select 1
    from   information_schema.columns
    where  table_name  = 'action_requests'
      and  column_name = 'risk_profile_id'
  ) then
    alter table action_requests
      add column risk_profile_id uuid
        references institution_risk_profiles (id) on delete set null;
  end if;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- (f) after_action_records: disaster_type, checked_items 컬럼 추가
--     기존 boolean 5개(outdoor_adjusted 등) 유지 — 레거시 호환
-- ─────────────────────────────────────────────────────────────
do $$
begin
  if not exists (
    select 1
    from   information_schema.columns
    where  table_name  = 'after_action_records'
      and  column_name = 'disaster_type'
  ) then
    alter table after_action_records
      add column disaster_type text not null default 'heatwave';
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from   information_schema.columns
    where  table_name  = 'after_action_records'
      and  column_name = 'checked_items'
  ) then
    alter table after_action_records
      add column checked_items jsonb not null default '{}'::jsonb;
  end if;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- (g) 데이터 이관: heatwave_profiles → institution_risk_profiles
--     폭염 특수 필드는 disaster_specific JSONB로 패킹
--     공통 컬럼(thermometer, first_aid_kit, indoor_alt_space)은 직접 컬럼으로
--     멱등: 동일 institution_id+disaster_type 행이 없을 때만 INSERT
-- ─────────────────────────────────────────────────────────────
insert into institution_risk_profiles (
  id,
  institution_id,
  disaster_type,
  thermometer,
  first_aid_kit,
  indoor_alt_space,
  disaster_specific,
  is_current,
  created_at
)
select
  hp.id,                       -- UUID 동일하게 이관 (FK 추적 가능)
  hp.institution_id,
  'heatwave'::text             as disaster_type,
  hp.thermometer,
  hp.first_aid_kit,
  hp.indoor_alt_space,
  jsonb_build_object(
    'heat_vulnerable_count',     hp.heat_vulnerable_count,
    'respiratory_caution_count', hp.respiratory_caution_count,
    'mobility_support_count',    hp.mobility_support_count,
    'special_support_count',     hp.special_support_count,
    'cooling_ok',                hp.cooling_ok,
    'water_supply_ok',           hp.water_supply_ok,
    'vehicle_thermometer',       hp.vehicle_thermometer,
    'pickup_wait_place',         hp.pickup_wait_place
  )                            as disaster_specific,
  hp.is_current,
  hp.created_at
from heatwave_profiles hp
where not exists (
  -- 이미 이관된 행이 있으면 건너뜀 (UUID 동일 기준)
  select 1
  from   institution_risk_profiles irp
  where  irp.id = hp.id
);

-- ─────────────────────────────────────────────────────────────
-- 검증용 주석: 이관 결과 확인 쿼리 (직접 실행 불가 — 참고용)
-- select count(*) from heatwave_profiles;
-- select count(*) from institution_risk_profiles where disaster_type='heatwave';
-- 두 값이 같으면 이관 완료
-- ─────────────────────────────────────────────────────────────
