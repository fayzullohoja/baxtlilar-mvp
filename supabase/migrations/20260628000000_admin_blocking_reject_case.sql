-- Sprint 3: blocking-reject (F-119 fake/minor/catfish) для НОВОЙ студии кейсов.
-- Атомарная обёртка: переиспользует проверенный admin_blocking_reject (телефон-
-- тумбстон + sha-блэклист + блокировка юзера, БЕЗ трогания onboarding_step, т.е.
-- без бага H-1) и в ОДНОЙ транзакции закрывает verification_case.
--
-- Заменяет старый /api/admin/verifications/[id]/decision (который нёс H-1).

create or replace function admin_blocking_reject_case(
  p_case_id          uuid,
  p_admin_id         uuid,
  p_reason           text,
  p_category         text,         -- 'fake' | 'minor' | 'catfish' (аудит/событие)
  p_phone_until_at   timestamptz
) returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_state     verification_case_state;
  v_assignee  uuid;
  v_user_id   uuid;
  v_user_upd  timestamptz;
  v_res       jsonb;
begin
  select state, assignee_id, user_id
    into v_state, v_assignee, v_user_id
    from verification_cases where id = p_case_id for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'case_not_found');
  end if;
  if v_state = 'closed' then
    return jsonb_build_object('ok', false, 'error', 'case_closed');
  end if;
  if v_assignee is null or v_assignee <> p_admin_id then
    return jsonb_build_object('ok', false, 'error', 'not_claimed_by_you');
  end if;
  if p_category not in ('fake', 'minor', 'catfish') then
    return jsonb_build_object('ok', false, 'error', 'bad_category');
  end if;

  -- актуальный users.updated_at для оптимистичной проверки внутри RPC
  select updated_at into v_user_upd from users where id = v_user_id for update;

  v_res := admin_blocking_reject(v_user_id, p_admin_id, p_reason, p_phone_until_at, v_user_upd);
  if not coalesce((v_res->>'ok')::boolean, false) then
    return v_res;  -- conflict / not_pending / reason_required / not_found
  end if;

  update verification_cases
    set state = 'closed', outcome = 'rejected_blocking',
        decided_by = p_admin_id, decided_at = now()
    where id = p_case_id;

  perform _emit_case_event(p_case_id, p_admin_id, 'decided',
    jsonb_build_object('outcome', 'rejected_blocking', 'category', p_category, 'reason', p_reason));

  perform enqueue_tg_outbox(v_user_id, 'verification_rejected',
    jsonb_build_object('reason', p_reason));

  return jsonb_build_object('ok', true, 'user_id', v_user_id,
    'phone_tombstone', v_res->'phone_tombstone_written');
end$$;
