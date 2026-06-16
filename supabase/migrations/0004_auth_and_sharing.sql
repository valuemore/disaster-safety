-- 0004_auth_and_sharing.sql
-- 전면 리팩토링: 간편 기관 로그인 + 어린이집포털 API 보강 + 역할별 연락처 + 공유 토큰
-- PostgreSQL 15+ / Supabase
-- 멱등(재실행 안전): do-block / if not exists 패턴
-- !! 원격 DB에 적용하지 말 것 — 사용자 확인 후 별도 실행 !!

-- ── 1. institutions: 인증 + API 보강 컬럼 ───────────────────────────────────
alter table institutions add column if not exists login_id text;
alter table institutions add column if not exists pin_hash text;
alter table institutions add column if not exists pin_set_at timestamptz;
-- 어린이집정보공개포털 식별코드(stcode) + 원본 JSON 보존(CCTV 등 저우선 필드 포함)
alter table institutions add column if not exists external_code text;
alter table institutions add column if not exists api_raw jsonb;
-- 아동수 출처: 'api'(포털 자동) | 'user_corrected'(원장 수정)
alter table institutions add column if not exists child_count_source text;

-- login_id 유니크 인덱스 (NULL 허용 — 미설정 기관 공존)
create unique index if not exists institutions_login_id_key
  on institutions (login_id)
  where login_id is not null;

-- ── 2. institution_staff_contacts: 역할별 담당자 연락처 (수신동의 포함) ──────
-- 개인정보 원칙: 교직원 업무 연락처는 공유·발송 목적에 한해 저장(수신동의 전제).
--                보호자(학부모) 연락처는 저장하지 않는다.
--                anon SELECT 정책 없음 → service_role(서버 라우트) 전용 접근.
create table if not exists institution_staff_contacts (
  id              uuid primary key default gen_random_uuid(),
  institution_id  uuid not null references institutions(id) on delete cascade,
  role            text not null check (role in (
                    'director','homeroom_teacher','bus_manager',
                    'cook_or_food_service','health_manager')),
  name            text,
  phone           text,
  email           text,
  consent_sms        boolean not null default false,
  consent_kakao      boolean not null default false,
  consent_share_link boolean not null default false,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (institution_id, role)
);

create index if not exists staff_contacts_institution_idx
  on institution_staff_contacts (institution_id);

alter table institution_staff_contacts enable row level security;
-- (정책 미생성 = anon/authenticated 접근 차단. service_role은 RLS 우회.)

-- ── 3. action_requests: 공유 토큰 ──────────────────────────────────────────
alter table action_requests add column if not exists share_token text;
create unique index if not exists action_requests_share_token_key
  on action_requests (share_token)
  where share_token is not null;

-- ── 4. (선택) 발송 로그 ─────────────────────────────────────────────────────
create table if not exists notify_logs (
  id                uuid primary key default gen_random_uuid(),
  action_request_id uuid references action_requests(id) on delete cascade,
  institution_id    uuid references institutions(id) on delete cascade,
  channel           text,            -- 'sms' | 'kakao' | 'sample'
  recipient_count   integer not null default 0,
  source            text,            -- 'api' | 'sample'
  created_at        timestamptz not null default now()
);
alter table notify_logs enable row level security;
