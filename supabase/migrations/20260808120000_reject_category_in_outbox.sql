-- Категория отказа в уведомлении (аудит админки 08.08.2026).
--
-- Шаблон verification_rejected ветвится по payload.reject_category, но ОБЕ RPC
-- клали payload без него → ветка по умолчанию. Пожизненно заблокированному
-- («не смогли подтвердить личность») уходило «Нужно переснять документы —
-- откройте Baxtlilar и попробуйте ещё раз», хотя повтор ему запрещён: человек
-- бьётся в закрытую дверь, а поддержка получает недоумённые обращения.
--
-- Тела скопированы из последних определений (20260628000000 и 20260709130000)
-- без иных изменений — правка ровно в одну строку payload каждой функции.

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

  -- reject_category ОБЯЗАТЕЛЕН: без него шаблон verification_rejected уходит в
  -- ветку «переснимите документы и попробуйте ещё раз», хотя это пожизненная
  -- блокировка и повтор запрещён.
  perform enqueue_tg_outbox(v_user_id, 'verification_rejected',
    jsonb_build_object('reason', p_reason, 'reject_category', 'blocking'));

  return jsonb_build_object('ok', true, 'user_id', v_user_id,
    'phone_tombstone', v_res->'phone_tombstone_written');
end$$;

create or replace function admin_reject_verification(
  p_case_id uuid,
  p_admin_id uuid,
  p_outcome text,
  p_reason_code text,
  p_reason_text text,
  p_expected_updated_at timestamptz
) returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_state verification_case_state;
  v_assignee uuid;
  v_user_id uuid;
  v_updated_at timestamptz;
  v_event_type text;
begin
  if p_outcome not in ('needs_changes','rejected_technical') then
    return jsonb_build_object('ok', false, 'error', 'bad_outcome');
  end if;

  select state, assignee_id, user_id, updated_at
    into v_state, v_assignee, v_user_id, v_updated_at
    from verification_cases where id = p_case_id for update;

  if not found then return jsonb_build_object('ok', false, 'error', 'case_not_found'); end if;
  if v_state = 'closed' then return jsonb_build_object('ok', false, 'error', 'case_closed'); end if;
  if v_assignee is null or v_assignee <> p_admin_id then
    return jsonb_build_object('ok', false, 'error', 'not_claimed_by_you');
  end if;
  if v_updated_at <> p_expected_updated_at then
    return jsonb_build_object('ok', false, 'error', 'stale_case', 'current_updated_at', v_updated_at);
  end if;
  if p_reason_text is null or length(p_reason_text) < 3 then
    return jsonb_build_object('ok', false, 'error', 'reason_required');
  end if;

  update verification_cases
    set state = 'closed', outcome = p_outcome,
        decided_by = p_admin_id, decided_at = now()
    where id = p_case_id;

  -- Update legacy users.verification_status (V1 client UI still reads this)
  -- + onboarding_step восстановления (FIX 2026-07-09) — только для онбординга.
  update users
    set verification_status = case
          when p_outcome = 'needs_changes' then 'needs_changes'::verification_status
          when p_outcome = 'rejected_technical' then 'rejected'::verification_status
          else verification_status
        end,
        onboarding_step = case
          when lifecycle_state = 'onboarding' and p_outcome = 'needs_changes'
            then 'needs_changes'
          when lifecycle_state = 'onboarding' and p_outcome = 'rejected_technical'
            then 'verification_rejected'
          else onboarding_step
        end
    where id = v_user_id;

  v_event_type := case p_outcome
    when 'needs_changes' then 'verification_needs_changes'
    when 'rejected_technical' then 'verification_rejected'
    else 'verification_rejected'
  end;

  perform _emit_case_event(p_case_id, p_admin_id, 'decided',
    jsonb_build_object('outcome', p_outcome, 'reason_code', p_reason_code, 'reason_text', p_reason_text));

  -- Технический отказ: повтор РАЗРЕШЁН — явно помечаем категорию, чтобы текст
  -- не зависел от отсутствия поля.
  perform enqueue_tg_outbox(v_user_id, v_event_type,
    jsonb_build_object('reason', p_reason_text, 'reject_category', 'technical'));

  return jsonb_build_object('ok', true, 'outcome', p_outcome);
end$$;

do $$ begin raise notice 'reject_category передаётся в tg_outbox.'; end $$;
