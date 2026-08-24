-- Инвариант 8: решения модератора по верификации теперь оставляют след в
-- истории статусов.
--
-- Находка аудита. admin_approve_verification и admin_reject_verification меняли
-- users.verification_status сырым UPDATE и писали только в admin_audit_log.
-- В user_state_transitions - журнале, по которому человек видит свою историю и
-- который отдаётся в выгрузке персональных данных, - двух самых частых решений
-- по человеку не было вовсе. Соседние решения того же экрана (admin_ban_confirm,
-- admin_blocking_reject) след пишут, то есть это расхождение, а не замысел.
--
-- Тела функций взяты из живой базы и изменены точечно: добавлен захват прежнего
-- значения и вставка в журнал. Логика решения не тронута.

CREATE OR REPLACE FUNCTION public.admin_approve_verification(p_case_id uuid, p_admin_id uuid, p_payload jsonb, p_expected_updated_at timestamp with time zone, p_face_match jsonb DEFAULT NULL::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_state verification_case_state;
  v_assignee uuid;
  v_user_id uuid;
  v_updated_at timestamptz;
  v_selfie_path text;
  v_identity_id uuid;
  v_pp_birth date := (p_payload->>'birth_date')::date;      -- паспортная дата
  v_pp_gender text := lower(p_payload->>'gender');           -- паспортный пол (M/F→m/f)
  v_old_birth date;
  v_old_gender text;
  v_corrections jsonb := '{}'::jsonb;
  v_old_verif text;
begin
  select state, assignee_id, user_id, updated_at
    into v_state, v_assignee, v_user_id, v_updated_at
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
  if v_updated_at <> p_expected_updated_at then
    return jsonb_build_object('ok', false, 'error', 'stale_case',
      'current_updated_at', v_updated_at);
  end if;

  if not (
    p_payload ? 'last_name' and p_payload ? 'first_name' and
    p_payload ? 'birth_date' and p_payload ? 'gender' and
    p_payload ? 'passport_series' and p_payload ? 'passport_number' and
    p_payload ? 'pinfl' and p_payload ? 'issued_by' and
    p_payload ? 'issued_at' and p_payload ? 'expires_at' and
    p_payload ? 'birth_place' and p_payload ? 'region_code' and
    p_payload ? 'district_code' and p_payload ? 'locality' and
    p_payload ? 'street_address' and p_payload ? 'citizenship'
  ) then
    return jsonb_build_object('ok', false, 'error', 'missing_required_fields');
  end if;

  update user_identity set superseded_at = now()
    where user_id = v_user_id and superseded_at is null;

  begin
    insert into user_identity(
      user_id, last_name, first_name, middle_name,
      birth_date, gender, citizenship, birth_place,
      passport_series, passport_number, pinfl,
      issued_by, issued_at, expires_at,
      region_code, district_code, locality, street_address,
      entered_by, source_case_id
    ) values (
      v_user_id, p_payload->>'last_name', p_payload->>'first_name', p_payload->>'middle_name',
      v_pp_birth, p_payload->>'gender', p_payload->>'citizenship', p_payload->>'birth_place',
      p_payload->>'passport_series', p_payload->>'passport_number', p_payload->>'pinfl',
      p_payload->>'issued_by', (p_payload->>'issued_at')::date, (p_payload->>'expires_at')::date,
      p_payload->>'region_code', p_payload->>'district_code', p_payload->>'locality', p_payload->>'street_address',
      p_admin_id, p_case_id
    ) returning id into v_identity_id;
  exception
    when unique_violation then
      return jsonb_build_object('ok', false, 'error', 'duplicate_identity');
  end;

  -- ── Коррекция профиля по паспорту (matching-критичное) ──────────────────────
  select birth_date, gender into v_old_birth, v_old_gender
    from user_profiles where user_id = v_user_id;
  if found then
    if v_old_birth is distinct from v_pp_birth then
      v_corrections := v_corrections || jsonb_build_object('birth_date',
        jsonb_build_object('from', v_old_birth, 'to', v_pp_birth));
    end if;
    -- Пол ставим только если паспортный валиден ('m'/'f') — не роняем approve
    -- constraint-violation'ом на неожиданном значении.
    if v_pp_gender in ('m', 'f') and v_old_gender is distinct from v_pp_gender then
      v_corrections := v_corrections || jsonb_build_object('gender',
        jsonb_build_object('from', v_old_gender, 'to', v_pp_gender));
    end if;
    update user_profiles
      set birth_date = v_pp_birth,
          gender = case when v_pp_gender in ('m', 'f') then v_pp_gender else gender end,
          updated_at = now()
      where user_id = v_user_id;
  end if;

  select selfie_path into v_selfie_path
    from user_documents where user_id = v_user_id
    order by created_at desc limit 1;

  select verification_status::text into v_old_verif from users where id = v_user_id;

  update users
    set avatar_path = coalesce(v_selfie_path, avatar_path),
        verification_status = 'approved'
    where id = v_user_id;

  -- Инвариант 8: смена статуса обязана оставлять след. Соседние решения того же
  -- экрана (бан, блокирующий отказ) его пишут, а одобрение и отказ верификации
  -- писали только в admin_audit_log - в истории статусов человека их не было.
  if v_old_verif is distinct from 'approved' then
    insert into user_state_transitions
      (user_id, field, from_value, to_value, reason, triggered_by_kind, triggered_by_id)
    values
      (v_user_id, 'verification_status', v_old_verif, 'approved',
       'verification approved by moderator', 'admin', p_admin_id::text);
  end if;

  update verification_cases
    set state = 'closed', outcome = 'approved',
        decided_by = p_admin_id, decided_at = now()
    where id = p_case_id;

  perform _emit_case_event(p_case_id, p_admin_id, 'decided',
    jsonb_build_object(
      'outcome', 'approved',
      'identity_id', v_identity_id,
      'face_match', p_face_match,
      'profile_corrections', v_corrections
    ));

  perform enqueue_tg_outbox(v_user_id, 'verification_approved', '{}'::jsonb);

  return jsonb_build_object('ok', true,
    'identity_id', v_identity_id,
    'user_id', v_user_id,
    'profile_corrections', v_corrections);
end$function$;

CREATE OR REPLACE FUNCTION public.admin_reject_verification(p_case_id uuid, p_admin_id uuid, p_outcome text, p_reason_code text, p_reason_text text, p_expected_updated_at timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_state verification_case_state;
  v_assignee uuid;
  v_user_id uuid;
  v_updated_at timestamptz;
  v_event_type text;
  v_old_verif text;
  v_new_verif text;
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

  select verification_status::text into v_old_verif from users where id = v_user_id;

  -- Update legacy users.verification_status (V1 client UI still reads this)
  -- + onboarding_step восстановления - ТОЛЬКО пока человек на до-анкетном шаге.
  -- Условие onboarding_step in (...) - это и есть фикс 2026-08-12: из анкеты
  -- (profile_*) перехода в needs_changes/verification_rejected в графе нет, и
  -- сырая запись туда роняла человеку сохранение анкеты в 409.
  update users
    set verification_status = case
          when p_outcome = 'needs_changes' then 'needs_changes'::verification_status
          when p_outcome = 'rejected_technical' then 'rejected'::verification_status
          else verification_status
        end,
        onboarding_step = case
          when lifecycle_state = 'onboarding'
               and onboarding_step in ('moderation_pending', 'doc_upload', 'selfie_upload')
               and p_outcome = 'needs_changes'
            then 'needs_changes'
          when lifecycle_state = 'onboarding'
               and onboarding_step in ('moderation_pending', 'doc_upload', 'selfie_upload')
               and p_outcome = 'rejected_technical'
            then 'verification_rejected'
          else onboarding_step
        end
    where id = v_user_id;

  -- Инвариант 8: смена статуса обязана оставлять след. Отказ модератора писался
  -- только в admin_audit_log, а в истории статусов человека его не было - в
  -- отличие от соседних решений того же экрана (бан, блокирующий отказ).
  select verification_status::text into v_new_verif from users where id = v_user_id;
  if v_old_verif is distinct from v_new_verif then
    insert into user_state_transitions
      (user_id, field, from_value, to_value, reason, triggered_by_kind, triggered_by_id)
    values
      (v_user_id, 'verification_status', v_old_verif, v_new_verif,
       'verification ' || p_outcome || coalesce(': ' || nullif(p_reason_code, ''), ''),
       'admin', p_admin_id::text);
  end if;

  v_event_type := case p_outcome
    when 'needs_changes' then 'verification_needs_changes'
    when 'rejected_technical' then 'verification_rejected'
    else 'verification_rejected'
  end;

  perform _emit_case_event(p_case_id, p_admin_id, 'decided',
    jsonb_build_object('outcome', p_outcome, 'reason_code', p_reason_code, 'reason_text', p_reason_text));

  -- Технический отказ: повтор РАЗРЕШЁН - явно помечаем категорию, чтобы текст
  -- не зависел от отсутствия поля.
  perform enqueue_tg_outbox(v_user_id, v_event_type,
    jsonb_build_object('reason', p_reason_text, 'reject_category', 'technical'));

  return jsonb_build_object('ok', true, 'outcome', p_outcome);
end$function$;
