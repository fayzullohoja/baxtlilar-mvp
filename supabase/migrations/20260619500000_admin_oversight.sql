-- 20260619500000_admin_oversight.sql
-- F-119 (two-person rule на permanent ban) + F-120 (moderator data-scope).
-- Дизайн от ультракод-workflow 2026-06-19; адаптирован под наш стек (RLS off,
-- service_role-only access — фильтрация делается в guard-слое).

-- =============================================================================
--  F-119: pending-ban пайплайн
-- =============================================================================

-- 1. Lifecycle enum: добавляем 'pending_ban' (промежуточный статус между
--    active и blocked). Добавляем в КОНЕЦ — порядок enum не часть API.
alter type lifecycle_state add value if not exists 'pending_ban';

-- 2. pending-ban-колонки на users.
alter table users
  add column if not exists pending_ban_at          timestamptz null,
  add column if not exists pending_ban_by_admin_id uuid        null
    references admin_users(id) on delete restrict,
  add column if not exists pending_ban_reason      text        null;

-- All-or-nothing: либо все три заполнены, либо все NULL. Защищает от
-- частичных записей, которые ломали бы same-admin/TTL-проверки.
alter table users
  drop constraint if exists users_pending_ban_consistency;
alter table users
  add constraint users_pending_ban_consistency check (
    (pending_ban_at is null
       and pending_ban_by_admin_id is null
       and pending_ban_reason is null)
    or
    (pending_ban_at is not null
       and pending_ban_by_admin_id is not null
       and pending_ban_reason is not null
       and length(btrim(pending_ban_reason)) > 0)
  );

-- Маленький partial index для expire-sweep.
create index if not exists users_pending_ban_at_idx
  on users (pending_ban_at)
  where pending_ban_at is not null;

-- 3. Атомарные функции ban-flow. Каждая делает row-lock + предикаты +
--    UPDATE + аудит-INSERT в одну транзакцию (FOR UPDATE → нет TOCTOU).
--    user_state_transitions заполняется ВНУТРИ функций (инвариант CLAUDE.md:
--    смена статуса = всегда строка в user_state_transitions).

create or replace function admin_ban_propose(
  p_user_id              uuid,
  p_admin_id             uuid,
  p_reason               text,
  p_expected_updated_at  timestamptz
) returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_row users%rowtype;
  v_new_updated timestamptz := now();
begin
  select * into v_row from users where id = p_user_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if v_row.updated_at <> p_expected_updated_at then
    return jsonb_build_object('ok', false, 'error', 'conflict');
  end if;
  if v_row.pending_ban_at is not null then
    return jsonb_build_object(
      'ok', false, 'error', 'already_pending',
      'pending_until', v_row.pending_ban_at,
      'pending_by',    v_row.pending_ban_by_admin_id
    );
  end if;
  if v_row.lifecycle_state in ('blocked','deleted','pending_ban') then
    return jsonb_build_object(
      'ok', false, 'error', 'not_eligible', 'state', v_row.lifecycle_state
    );
  end if;
  if p_reason is null or length(btrim(p_reason)) = 0 then
    return jsonb_build_object('ok', false, 'error', 'reason_required');
  end if;

  update users set
    lifecycle_state         = 'pending_ban',
    pending_ban_at          = v_new_updated,
    pending_ban_by_admin_id = p_admin_id,
    pending_ban_reason      = p_reason,
    updated_at              = v_new_updated
  where id = p_user_id;

  insert into user_state_transitions
    (user_id, field, from_value, to_value, reason, triggered_by_kind, triggered_by_id)
  values
    (p_user_id, 'lifecycle_state', v_row.lifecycle_state::text, 'pending_ban',
     'ban_proposed: ' || p_reason, 'admin', p_admin_id::text);

  return jsonb_build_object(
    'ok', true, 'pending_until', v_new_updated,
    'prev_lifecycle', v_row.lifecycle_state, 'updated_at', v_new_updated
  );
end;
$$;

create or replace function admin_ban_confirm(
  p_user_id                  uuid,
  p_admin_id                 uuid,
  p_ttl_seconds              integer,
  p_blocked_reason_override  text,
  p_expected_updated_at      timestamptz
) returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_row users%rowtype;
  v_new_updated timestamptz := now();
  v_final_reason text;
begin
  select * into v_row from users where id = p_user_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if v_row.updated_at <> p_expected_updated_at then
    return jsonb_build_object('ok', false, 'error', 'conflict');
  end if;
  if v_row.pending_ban_at is null or v_row.pending_ban_by_admin_id is null then
    return jsonb_build_object('ok', false, 'error', 'no_pending_proposal');
  end if;
  -- TTL проверяется в SQL через clock'ы DB — никаких window-skew между Node и PG.
  if v_row.pending_ban_at < (now() - make_interval(secs => p_ttl_seconds)) then
    return jsonb_build_object(
      'ok', false, 'error', 'expired', 'pending_at', v_row.pending_ban_at
    );
  end if;
  -- Same-admin gate: confirm должен быть от ДРУГОГО админа.
  if v_row.pending_ban_by_admin_id = p_admin_id then
    return jsonb_build_object('ok', false, 'error', 'same_admin');
  end if;

  v_final_reason := coalesce(
    nullif(btrim(p_blocked_reason_override), ''), v_row.pending_ban_reason
  );

  update users set
    lifecycle_state         = 'blocked',
    blocked_at              = v_new_updated,
    blocked_reason          = v_final_reason,
    pending_ban_at          = null,
    pending_ban_by_admin_id = null,
    pending_ban_reason      = null,
    updated_at              = v_new_updated
  where id = p_user_id;

  insert into user_state_transitions
    (user_id, field, from_value, to_value, reason, triggered_by_kind, triggered_by_id)
  values
    (p_user_id, 'lifecycle_state', 'pending_ban', 'blocked',
     'ban_confirmed: ' || v_final_reason, 'admin', p_admin_id::text);

  return jsonb_build_object(
    'ok', true,
    'proposer_admin_id', v_row.pending_ban_by_admin_id,
    'proposer_reason',   v_row.pending_ban_reason,
    'final_reason',      v_final_reason,
    'updated_at',        v_new_updated
  );
end;
$$;

create or replace function admin_ban_cancel(
  p_user_id              uuid,
  p_admin_id             uuid,
  p_restore_state        lifecycle_state,
  p_expected_updated_at  timestamptz
) returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_row users%rowtype;
  v_new_updated timestamptz := now();
begin
  select * into v_row from users where id = p_user_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if v_row.updated_at <> p_expected_updated_at then
    return jsonb_build_object('ok', false, 'error', 'conflict');
  end if;
  if v_row.pending_ban_at is null then
    return jsonb_build_object('ok', false, 'error', 'no_pending_proposal');
  end if;

  update users set
    lifecycle_state         = p_restore_state,
    pending_ban_at          = null,
    pending_ban_by_admin_id = null,
    pending_ban_reason      = null,
    -- belt-and-suspenders: подчистим возможные остатки прошлого цикла
    blocked_at              = null,
    blocked_reason          = null,
    updated_at              = v_new_updated
  where id = p_user_id;

  insert into user_state_transitions
    (user_id, field, from_value, to_value, reason, triggered_by_kind, triggered_by_id)
  values
    (p_user_id, 'lifecycle_state', 'pending_ban', p_restore_state::text,
     'ban_cancelled', 'admin', p_admin_id::text);

  return jsonb_build_object(
    'ok', true,
    'proposer_admin_id', v_row.pending_ban_by_admin_id,
    'proposer_reason',   v_row.pending_ban_reason,
    'restored_state',    p_restore_state,
    'updated_at',        v_new_updated
  );
end;
$$;

-- Sweep всех истёкших proposals. Вызывается перед каждым /ban POST'ом
-- (lazy expiration — нет крон-инфры). Возвращает строки, которые истекли,
-- чтобы app-слой залогировал каждый ban_proposal_expired в admin_audit_log.
create or replace function admin_ban_expire_sweep(
  p_ttl_seconds integer,
  p_limit       integer default 200
) returns table (
  user_id          uuid,
  proposer_id      uuid,
  proposer_reason  text,
  restored_state   lifecycle_state
)
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_cutoff timestamptz := now() - make_interval(secs => p_ttl_seconds);
begin
  return query
  with stale as (
    select id,
           pending_ban_by_admin_id  as proposer_id,
           pending_ban_reason        as proposer_reason,
           case when quiz_completion = 'completed' then 'active'::lifecycle_state
                else 'onboarding'::lifecycle_state end as restored_state
      from users
     where pending_ban_at is not null
       and pending_ban_at < v_cutoff
     order by pending_ban_at
     limit p_limit
     for update skip locked
  ),
  applied as (
    update users u set
      lifecycle_state         = s.restored_state,
      pending_ban_at          = null,
      pending_ban_by_admin_id = null,
      pending_ban_reason      = null,
      updated_at              = now()
    from stale s
    where u.id = s.id
    returning s.id, s.proposer_id, s.proposer_reason, s.restored_state
  ),
  logged as (
    insert into user_state_transitions
      (user_id, field, from_value, to_value, reason, triggered_by_kind, triggered_by_id)
    select a.id, 'lifecycle_state', 'pending_ban', a.restored_state::text,
           'ban_proposal_expired_24h', 'system', null
    from applied a
    returning user_id
  )
  select a.id, a.proposer_id, a.proposer_reason, a.restored_state from applied a;
end;
$$;

-- =============================================================================
--  F-120: out-of-queue audit log (отдельная таблица + rate-bucket)
-- =============================================================================

-- Отдельно от admin_audit_log, чтобы:
--  - downstream alerting видел только high-priority signals;
--  - retention отличен (этот лог хранится только N дней);
--  - не превращать admin_audit_log в "карту опросов" (P10/audit-PII oracle).
-- entity_id хешируется HMAC(SESSION_SECRET) в app-слое — корреляция возможна
-- для security-review, но dump БД сам по себе не выдаёт target user_id в plaintext.
create table if not exists admin_scope_violations (
  id              uuid primary key default gen_random_uuid(),
  admin_id        uuid not null references admin_users(id) on delete restrict,
  action          text not null check (action in (
    'out_of_queue_doc_view',
    'out_of_queue_decision_attempt',
    'out_of_queue_user_view',
    'out_of_queue_rate_exceeded'
  )),
  entity_id_hash  text not null,
  ip              text,
  occurred_at     timestamptz not null default now()
);

create index if not exists admin_scope_violations_admin_time_idx
  on admin_scope_violations (admin_id, occurred_at desc);
create index if not exists admin_scope_violations_action_time_idx
  on admin_scope_violations (action, occurred_at desc);

-- Per-admin token bucket: anti-flood для violation-лога. Сам нарушитель не
-- может задовить лог тысячами строк и спрятать сигнал.
create table if not exists admin_scope_violation_buckets (
  admin_id     uuid primary key references admin_users(id) on delete cascade,
  window_start timestamptz not null,
  count        integer not null default 0
);

create or replace function admin_scope_violation_admit(
  p_admin_id       uuid,
  p_window_secs    integer default 60,
  p_max_in_window  integer default 10
) returns boolean
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_now timestamptz := now();
  v_count integer;
begin
  insert into admin_scope_violation_buckets (admin_id, window_start, count)
    values (p_admin_id, v_now, 1)
    on conflict (admin_id) do update set
      window_start = case
        when admin_scope_violation_buckets.window_start
             < v_now - make_interval(secs => p_window_secs)
        then v_now
        else admin_scope_violation_buckets.window_start
      end,
      count = case
        when admin_scope_violation_buckets.window_start
             < v_now - make_interval(secs => p_window_secs)
        then 1
        else admin_scope_violation_buckets.count + 1
      end
    returning count into v_count;

  return v_count <= p_max_in_window;
end;
$$;
