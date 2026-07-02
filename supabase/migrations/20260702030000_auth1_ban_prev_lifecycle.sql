-- AUTH-1 / DBL-1 — сохраняем истинное pre-ban состояние и восстанавливаем ИМЕННО его.
--
-- Раньше admin_ban_propose знал pre-ban lifecycle (возвращал prev_lifecycle), но
-- не персистил его. admin_ban_cancel применял p_restore_state, а guard.ts выводил
-- его из quiz_completion (только active/onboarding); admin_ban_expire_sweep тоже
-- выводил active/onboarding из quiz_completion. Итог: paused-юзер (сам поставил
-- паузу, скрыт из фида, не получает интересы), которому предложили и отменили бан
-- — или чьё предложение истекло — воскресал в 'active' → снова виден в фиде и
-- получает интересы против своей паузы.
--
-- Фикс: колонка users.pending_ban_prev_lifecycle. propose пишет туда текущий
-- lifecycle; cancel/expire восстанавливают из неё (fallback на старую логику для
-- легаси-строк без значения).

alter table users add column if not exists pending_ban_prev_lifecycle lifecycle_state;

-- 1) propose — сохраняем истинный pre-ban lifecycle.
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
    lifecycle_state             = 'pending_ban',
    pending_ban_at              = v_new_updated,
    pending_ban_by_admin_id     = p_admin_id,
    pending_ban_reason          = p_reason,
    pending_ban_prev_lifecycle  = v_row.lifecycle_state,  -- AUTH-1: истинное pre-ban состояние
    updated_at                  = v_new_updated
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

-- 2) cancel — восстанавливаем сохранённое состояние (fallback на p_restore_state).
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
  v_restore lifecycle_state;
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

  -- AUTH-1: предпочитаем сохранённое истинное состояние; p_restore_state — fallback.
  v_restore := coalesce(v_row.pending_ban_prev_lifecycle, p_restore_state);

  update users set
    lifecycle_state            = v_restore,
    pending_ban_at             = null,
    pending_ban_by_admin_id    = null,
    pending_ban_reason         = null,
    pending_ban_prev_lifecycle = null,
    -- belt-and-suspenders: подчистим возможные остатки прошлого цикла
    blocked_at                 = null,
    blocked_reason             = null,
    updated_at                 = v_new_updated
  where id = p_user_id;

  insert into user_state_transitions
    (user_id, field, from_value, to_value, reason, triggered_by_kind, triggered_by_id)
  values
    (p_user_id, 'lifecycle_state', 'pending_ban', v_restore::text,
     'ban_cancelled', 'admin', p_admin_id::text);

  return jsonb_build_object(
    'ok', true,
    'proposer_admin_id', v_row.pending_ban_by_admin_id,
    'proposer_reason',   v_row.pending_ban_reason,
    'restored_state',    v_restore,
    'updated_at',        v_new_updated
  );
end;
$$;

-- 3) expire sweep — восстанавливаем сохранённое состояние (fallback на derive).
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
           coalesce(
             pending_ban_prev_lifecycle,
             case when quiz_completion = 'completed' then 'active'::lifecycle_state
                  else 'onboarding'::lifecycle_state end
           ) as restored_state
      from users
     where pending_ban_at is not null
       and pending_ban_at < v_cutoff
     order by pending_ban_at
     limit p_limit
     for update skip locked
  ),
  applied as (
    update users u set
      lifecycle_state            = s.restored_state,
      pending_ban_at             = null,
      pending_ban_by_admin_id    = null,
      pending_ban_reason         = null,
      pending_ban_prev_lifecycle = null,
      updated_at                 = now()
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
    returning user_state_transitions.id
  )
  select a.id, a.proposer_id, a.proposer_reason, a.restored_state
    from applied a
    where (select count(*) from logged) >= 0;
end;
$$;
