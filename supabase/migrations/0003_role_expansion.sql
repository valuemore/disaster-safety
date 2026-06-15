-- 0003_role_expansion.sql
-- action_requests.created_by_role CHECK 확장: 2종 추가
-- 기존: ('admin','director','teacher','shuttle')
-- 신규: + 'cook_or_food_service', 'health_manager'
-- PostgreSQL 15+ / Supabase
-- 멱등(재실행 안전): do-block 패턴
-- !! 원격 DB에 적용하지 말 것 — 사용자 확인 후 별도 실행 !!

do $$
begin
  -- 기존 인라인 CHECK 제거 (0001_initial.sql에서 이름 없이 생성 → 자동명: action_requests_created_by_role_check)
  if exists (
    select 1
    from   pg_constraint
    where  conname   = 'action_requests_created_by_role_check'
      and  conrelid  = 'action_requests'::regclass
  ) then
    alter table action_requests
      drop constraint action_requests_created_by_role_check;
  end if;

  -- 확장된 CHECK 추가 (6종: admin 포함)
  if not exists (
    select 1
    from   pg_constraint
    where  conname   = 'action_requests_created_by_role_check'
      and  conrelid  = 'action_requests'::regclass
  ) then
    alter table action_requests
      add constraint action_requests_created_by_role_check
      check (created_by_role in (
        'admin',
        'director',
        'teacher',
        'shuttle',
        'cook_or_food_service',
        'health_manager'
      ));
  end if;
end;
$$;
