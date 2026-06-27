-- Phase C: atomic case operations. Each RPC = одна транзакция с inline checks
-- + audit log writes (через case_events). Frontend никогда не композирует
-- multi-step DB ops — всё через эти 4 функции.

-- Helper: append to case_events (immutable timeline)
create or replace function _emit_case_event(
  p_case_id uuid,
  p_actor uuid,
  p_action text,
  p_payload jsonb default '{}'::jsonb
) returns void language plpgsql as $$
begin
  insert into case_events(case_id, actor_id, action, payload)
  values (p_case_id, p_actor, p_action, p_payload);
end$$;

-- ============ CLAIM ============
-- Атомарный claim: assigned_id := admin, state := 'assigned'.
-- 409 если уже claimed другим, 400 если closed.

create or replace function admin_claim_verification(
  p_case_id uuid,
  p_admin_id uuid
) returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_state verification_case_state;
  v_assignee uuid;
begin
  select state, assignee_id into v_state, v_assignee
    from verification_cases where id = p_case_id for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'case_not_found');
  end if;

  if v_state = 'closed' then
    return jsonb_build_object('ok', false, 'error', 'case_closed');
  end if;

  if v_assignee is not null and v_assignee <> p_admin_id then
    return jsonb_build_object('ok', false, 'error', 'case_already_claimed',
                              'assignee_id', v_assignee);
  end if;

  update verification_cases
    set state = 'assigned',
        assignee_id = p_admin_id,
        claimed_at = coalesce(claimed_at, now())
    where id = p_case_id;

  perform _emit_case_event(p_case_id, p_admin_id, 'claimed', '{}'::jsonb);

  return jsonb_build_object('ok', true, 'state', 'assigned');
end$$;

-- ============ SAVE DRAFT ============
-- Сохраняет partial PassportPayload в draft_payload jsonb.
-- Переводит state в 'data_entry' если был в assigned/in_review.

create or replace function admin_save_passport_draft(
  p_case_id uuid,
  p_admin_id uuid,
  p_payload jsonb
) returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_state verification_case_state;
  v_assignee uuid;
  v_new_updated_at timestamptz;
begin
  select state, assignee_id into v_state, v_assignee
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

  update verification_cases
    set draft_payload = p_payload,
        state = case
          when v_state in ('assigned','in_review') then 'data_entry'::verification_case_state
          else v_state
        end
    where id = p_case_id
    returning updated_at into v_new_updated_at;

  perform _emit_case_event(p_case_id, p_admin_id, 'draft_saved',
    jsonb_build_object('field_count', (select count(*) from jsonb_object_keys(p_payload))));

  return jsonb_build_object('ok', true, 'updated_at', v_new_updated_at);
end$$;

-- ============ APPROVE ============
-- The big one: atomic transaction
-- 1. lock case + optimistic concurrency check
-- 2. validate required fields server-side (defense-in-depth)
-- 3. supersede prior identity if re-verification
-- 4. insert user_identity (will throw on duplicate ПИНФЛ / passport)
-- 5. set users.avatar_path = selfie_path (требование #4)
-- 6. set users.verification_status = 'approved'
-- 7. close case (state, outcome, decided_by, decided_at)
-- 8. emit case_event
-- 9. enqueue tg_outbox 'verification_approved'

create or replace function admin_approve_verification(
  p_case_id uuid,
  p_admin_id uuid,
  p_payload jsonb,
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
  v_selfie_path text;
  v_identity_id uuid;
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

  -- Defense-in-depth: проверка required-полей даже если frontend пропустил
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

  -- Re-verification: помечаем старую identity как superseded
  update user_identity
    set superseded_at = now()
    where user_id = v_user_id and superseded_at is null;

  -- Insert new identity (бросит unique_violation на дубль ПИНФЛ или passport)
  begin
    insert into user_identity(
      user_id, last_name, first_name, middle_name,
      birth_date, gender, citizenship, birth_place,
      passport_series, passport_number, pinfl,
      issued_by, issued_at, expires_at,
      region_code, district_code, locality, street_address,
      entered_by, source_case_id
    ) values (
      v_user_id,
      p_payload->>'last_name',
      p_payload->>'first_name',
      p_payload->>'middle_name',
      (p_payload->>'birth_date')::date,
      p_payload->>'gender',
      p_payload->>'citizenship',
      p_payload->>'birth_place',
      p_payload->>'passport_series',
      p_payload->>'passport_number',
      p_payload->>'pinfl',
      p_payload->>'issued_by',
      (p_payload->>'issued_at')::date,
      (p_payload->>'expires_at')::date,
      p_payload->>'region_code',
      p_payload->>'district_code',
      p_payload->>'locality',
      p_payload->>'street_address',
      p_admin_id,
      p_case_id
    ) returning id into v_identity_id;
  exception
    when unique_violation then
      return jsonb_build_object('ok', false, 'error', 'duplicate_identity');
  end;

  -- Селфи путь — берём из последнего user_documents (uploaded в onboarding)
  select selfie_path into v_selfie_path
    from user_documents
    where user_id = v_user_id
    order by created_at desc
    limit 1;

  -- Avatar = approved selfie (требование учредителя #4)
  update users
    set avatar_path = coalesce(v_selfie_path, avatar_path),
        verification_status = 'approved'
    where id = v_user_id;

  update verification_cases
    set state = 'closed',
        outcome = 'approved',
        decided_by = p_admin_id,
        decided_at = now()
    where id = p_case_id;

  perform _emit_case_event(p_case_id, p_admin_id, 'decided',
    jsonb_build_object('outcome','approved','identity_id', v_identity_id));

  perform enqueue_tg_outbox(v_user_id, 'verification_approved', '{}'::jsonb);

  return jsonb_build_object('ok', true,
    'identity_id', v_identity_id,
    'user_id', v_user_id);
end$$;

-- ============ REJECT (needs_changes / rejected_technical) ============
-- Blocking-reject (с F-119 two-person rule) — Sprint 3.

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
  update users
    set verification_status = case
      when p_outcome = 'needs_changes' then 'needs_changes'::verification_status
      when p_outcome = 'rejected_technical' then 'rejected'::verification_status
      else verification_status
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
