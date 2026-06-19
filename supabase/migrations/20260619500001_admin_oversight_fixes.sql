-- 20260619500001_admin_oversight_fixes.sql
-- Adversarial-verify findings от ультракод-workflow по 20260619500000:
--   R3-BUG1 (CRITICAL): admin_ban_expire_sweep "logged" CTE никогда не
--     срабатывал — final SELECT не ссылался на него → INSERT'ы в
--     user_state_transitions не выполнялись (silent loss of audit trail).
--   R1-#1 (HIGH): transition_user не блокирует lifecycle_state IN
--     ('blocked','pending_ban') — будущий обход F-119 через generic RPC.
--   R1-#2/R1-#5 (belt-and-suspenders): admin_ban_confirm доп. проверяет
--     p_admin_id IS NOT NULL и lifecycle_state='pending_ban'.
--   R3-BUG5: cross-column constraint blocked_at vs pending_ban_at не должны
--     быть одновременно set'нуты.

-- =============================================================================
--  R3-BUG1: правильный sweep — logged CTE теперь забран join'ом
-- =============================================================================
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
    -- Квалифицируем имя таблицы — иначе ambiguous с PL/pgSQL output-колонкой
    -- user_id того же return-type'а.
    returning user_state_transitions.id
  )
  -- Ссылка на logged — без неё PG оптимизирует CTE и INSERT'ы не пишутся.
  -- LEFT JOIN c COUNT(*) форсит чтение logged. SUM/COUNT по logged всегда
  -- равен count(applied), но Postgres гарантированно вычислит INSERT.
  select a.id, a.proposer_id, a.proposer_reason, a.restored_state
    from applied a
    where (select count(*) from logged) >= 0;
end;
$$;

-- =============================================================================
--  R1-#2 + R1-#5: дополнительные проверки в admin_ban_confirm
-- =============================================================================
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
  -- R1-#2: fail-closed на NULL admin_id (вдруг будущий callsite забыл).
  if p_admin_id is null then
    return jsonb_build_object('ok', false, 'error', 'admin_id_required');
  end if;

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
  -- R1-#5: явная проверка lifecycle_state. constraint+propose должны это
  -- гарантировать, но дешёвый belt против будущих регрессий.
  if v_row.lifecycle_state <> 'pending_ban' then
    return jsonb_build_object('ok', false, 'error', 'inconsistent_state',
                              'state', v_row.lifecycle_state);
  end if;
  if v_row.pending_ban_at < (now() - make_interval(secs => p_ttl_seconds)) then
    return jsonb_build_object('ok', false, 'error', 'expired',
                              'pending_at', v_row.pending_ban_at);
  end if;
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

-- =============================================================================
--  R3-BUG5: cross-column constraint — нельзя одновременно blocked + pending_ban
-- =============================================================================
alter table users
  drop constraint if exists users_no_both_block_and_pending;
alter table users
  add constraint users_no_both_block_and_pending check (
    blocked_at is null or pending_ban_at is null
  );

-- =============================================================================
--  R1-#1: transition_user guard против lifecycle_state IN (blocked, pending_ban)
-- =============================================================================
-- Все ban-переходы должны идти через admin_ban_propose/confirm/cancel.
-- transition_user перестаёт принимать эти значения lifecycle_state — будущий
-- PR, который попробует "shadow-ban" через generic RPC, упадёт громко.
create or replace function transition_user(
  p_user_id uuid,
  p_patch jsonb,
  p_expected_updated_at timestamptz,
  p_reason text,
  p_by_kind triggered_by_kind,
  p_by_id text
) returns jsonb
language plpgsql
as $$
declare
  v_old users%rowtype;
  v_key text;
  v_old_val text;
  v_new_val text;
  v_target_lifecycle text;
begin
  select * into v_old from users where id = p_user_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if v_old.updated_at is distinct from p_expected_updated_at then
    return jsonb_build_object('ok', false, 'error', 'conflict');
  end if;

  -- R1-#1: ban-переходы ТОЛЬКО через admin_ban_* RPC.
  v_target_lifecycle := p_patch->>'lifecycle_state';
  if v_target_lifecycle in ('blocked','pending_ban') then
    return jsonb_build_object('ok', false, 'error', 'ban_via_dedicated_rpc',
                              'target', v_target_lifecycle);
  end if;

  update users set
    lifecycle_state     = coalesce((p_patch->>'lifecycle_state')::lifecycle_state, lifecycle_state),
    onboarding_step     = coalesce((p_patch->>'onboarding_step')::onboarding_step, onboarding_step),
    verification_status = coalesce((p_patch->>'verification_status')::verification_status, verification_status),
    profile_completion  = coalesce((p_patch->>'profile_completion')::profile_completion, profile_completion),
    quiz_completion     = coalesce((p_patch->>'quiz_completion')::quiz_completion, quiz_completion),
    phone_verified      = coalesce((p_patch->>'phone_verified')::boolean, phone_verified),
    phone_number        = coalesce(p_patch->>'phone_number', phone_number),
    language            = coalesce(p_patch->>'language', language),
    blocked_at          = case when p_patch ? 'blocked_at' then (p_patch->>'blocked_at')::timestamptz else blocked_at end,
    blocked_reason      = case when p_patch ? 'blocked_reason' then p_patch->>'blocked_reason' else blocked_reason end
  where id = p_user_id;

  for v_key in select jsonb_object_keys(p_patch) loop
    v_old_val := to_jsonb(v_old) ->> v_key;
    v_new_val := p_patch ->> v_key;
    if v_old_val is distinct from v_new_val then
      insert into user_state_transitions(
        user_id, field, from_value, to_value, reason, triggered_by_kind, triggered_by_id
      ) values (p_user_id, v_key, v_old_val, v_new_val, p_reason, p_by_kind, p_by_id);
    end if;
  end loop;

  return jsonb_build_object('ok', true);
end;
$$;
