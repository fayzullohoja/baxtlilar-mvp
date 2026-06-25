-- 20260625000000_v2_shadow_active.sql
-- V2 Frontend Redesign — Shadow Active model + Tutorial flow
--
-- Изменения:
-- 1. Добавляем колонку verification_submitted_at (когда юзер отправил доки)
-- 2. Добавляем колонку tutorial_seen_at (returning users skip tutorial)
-- 3. Создаём tg_outbox таблицу для async push-уведомлений
--    (модератор approve → запись в outbox → бот шлёт в TG)
-- 4. Обновляем check constraint для новых onboarding_step значений
-- 5. Индекс для Shadow Active фильтрации в get_recommendations

-- =============================================================================
-- 1. Колонка verification_submitted_at
-- =============================================================================
alter table users
  add column if not exists verification_submitted_at timestamptz;

-- Backfill: для существующих юзеров с verification_status != not_started
-- предполагаем что они уже отправили — берём updated_at.
update users
  set verification_submitted_at = updated_at
  where verification_submitted_at is null
    and verification_status not in ('not_started', 'phone_verified');

-- =============================================================================
-- 2. Колонка tutorial_seen_at
-- =============================================================================
alter table users
  add column if not exists tutorial_seen_at timestamptz;

-- =============================================================================
-- 3. tg_outbox — append-only очередь для push в TG
-- =============================================================================
create table if not exists tg_outbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  event_type text not null check (event_type in (
    'verification_approved',
    'verification_needs_changes',
    'verification_rejected',
    'tutorial_reminder'
  )),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  attempts integer not null default 0,
  last_error text
);

create index if not exists tg_outbox_unsent_idx
  on tg_outbox (created_at)
  where sent_at is null;

create index if not exists tg_outbox_user_idx
  on tg_outbox (user_id, created_at desc);

-- =============================================================================
-- 4. Enum extension для нового onboarding_step
-- =============================================================================
-- onboarding_step — Postgres enum type (а не text+CHECK). Расширяем через
-- ALTER TYPE ADD VALUE IF NOT EXISTS. Постгрес 12+ позволяет это в
-- транзакции; новые значения становятся видимыми после commit.
alter type onboarding_step add value if not exists 'tutorial_intro';
alter type onboarding_step add value if not exists 'tutorial_swipe';
alter type onboarding_step add value if not exists 'tutorial_chat';
alter type onboarding_step add value if not exists 'tutorial_safety';
alter type onboarding_step add value if not exists 'ready';

-- =============================================================================
-- 5. Индекс для Shadow Active фильтрации
-- =============================================================================
-- get_recommendations использует: WHERE lifecycle_state='active' AND verification_status='approved'
-- Composite index для быстрой фильтрации.
create index if not exists users_shadow_active_idx
  on users (lifecycle_state, verification_status)
  where lifecycle_state = 'active';

-- =============================================================================
-- 6. RPC helper: enqueue_tg_outbox (для admin_blocking_reject + approve callers)
-- =============================================================================
create or replace function enqueue_tg_outbox(
  p_user_id uuid,
  p_event_type text,
  p_payload jsonb default '{}'::jsonb
) returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  insert into tg_outbox(user_id, event_type, payload)
  values (p_user_id, p_event_type, p_payload)
  returning id into v_id;
  return v_id;
end;
$$;

-- =============================================================================
-- Verify
-- =============================================================================
do $$
begin
  raise notice 'V2 Shadow Active migration applied. Verify:';
  raise notice '  - users.verification_submitted_at column: %',
    (select count(*) from information_schema.columns
     where table_name='users' and column_name='verification_submitted_at');
  raise notice '  - users.tutorial_seen_at column: %',
    (select count(*) from information_schema.columns
     where table_name='users' and column_name='tutorial_seen_at');
  raise notice '  - tg_outbox table: %',
    (select count(*) from information_schema.tables
     where table_name='tg_outbox');
end $$;
