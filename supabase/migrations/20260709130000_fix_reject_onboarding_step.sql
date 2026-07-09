-- FIX (2026-07-09, code-review CRITICAL): admin_reject_verification ставил
-- users.verification_status, но НЕ onboarding_step. После needs_changes /
-- rejected_technical пользователь в онбординге застревал на moderation_pending:
-- клиент показывал «на проверке» бесконечно, а экраны восстановления
-- (/onboarding/needs-changes, /onboarding/rejected) недостижимы, т.к. их роуты
-- гейтятся loadUserForStep("needs_changes") / ("verification_rejected").
--
-- Чиним: тем же UPDATE переводим onboarding_step в нужный шаг восстановления.
-- ТОЛЬКО для lifecycle_state='onboarding'. Shadow-Active (lifecycle='active',
-- заполняет анкету пока идёт проверка) НЕ трогаем — их путь восстановления это
-- плашка на /main; что делать с active-юзером при needs_changes — решение
-- учредителя (не дёргаем назад в онбординг автоматически).
--
-- Идемпотентно: create or replace. Тело функции идентично
-- 20260627100400_admin_case_rpcs.sql, изменён только блок UPDATE users.

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

  perform enqueue_tg_outbox(v_user_id, v_event_type,
    jsonb_build_object('reason', p_reason_text));

  return jsonb_build_object('ok', true, 'outcome', p_outcome);
end$$;
