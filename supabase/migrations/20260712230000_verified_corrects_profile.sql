-- Верифицированные факты из паспорта — авторитетнее self-declared анкеты.
-- Раньше approve писал паспорт только в user_identity, а user_profiles (по нему
-- идёт ПОДБОР) оставался таким, как юзер сам заполнил — мог соврать про возраст/
-- пол. Теперь при подтверждении matching-критичные факты профиля исправляются на
-- паспортные: дата рождения (возраст/18+) и пол. Гео/имя НЕ трогаем (гео —
-- преференция юзера, display_name — ник, а не паспортное имя).
--
-- Коррекции пишутся в payload события 'decided' (append-only case_events) — есть
-- аудит-след «исправили самозаявленный возраст X → паспортный Y».
--
-- Сигнатура не меняется → create or replace (без drop). Тело скопировано из
-- 20260704050000 + добавлен блок коррекции профиля.

create or replace function admin_approve_verification(
  p_case_id uuid,
  p_admin_id uuid,
  p_payload jsonb,
  p_expected_updated_at timestamptz,
  p_face_match jsonb default null
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
  v_pp_birth date := (p_payload->>'birth_date')::date;      -- паспортная дата
  v_pp_gender text := lower(p_payload->>'gender');           -- паспортный пол (M/F→m/f)
  v_old_birth date;
  v_old_gender text;
  v_corrections jsonb := '{}'::jsonb;
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

  update users
    set avatar_path = coalesce(v_selfie_path, avatar_path),
        verification_status = 'approved'
    where id = v_user_id;

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
end$$;

do $$ begin raise notice 'approve now corrects profile birth_date+gender from passport.'; end $$;
