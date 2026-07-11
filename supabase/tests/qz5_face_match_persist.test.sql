-- QZ-5 — admin_approve_verification пишет p_face_match в payload события 'decided'
-- (case_events). Аудит ручной сверки лица должен быть восстановим.

begin;

do $$
declare
  adm uuid; usr uuid; cid uuid; upd timestamptz; r jsonb; fm jsonb; ev jsonb;
begin
  insert into admin_users (login, role, password_hash)
    values ('t_mod_qz5', 'superadmin', 'x') returning id into adm;

  -- pending_review на INSERT → VF-1 триггер создаёт открытый кейс
  insert into users (telegram_id, verification_status, lifecycle_state)
    values (990010100, 'pending_review', 'onboarding') returning id into usr;
  select id into cid from verification_cases where user_id = usr and state <> 'closed';
  if cid is null then raise exception 'VF-1: кейс не создан триггером'; end if;

  -- назначаем админа (updated_at авто-бампится триггером)
  update verification_cases set assignee_id = adm, state = 'assigned' where id = cid;
  select updated_at into upd from verification_cases where id = cid;

  fm := jsonb_build_object('face_selfie_matches', true, 'liveness_ok', true, 'age_matches', false);

  r := admin_approve_verification(
    cid, adm,
    jsonb_build_object(
      'last_name','Тест','first_name','Иван','middle_name','Петрович',
      'birth_date','1995-01-01','gender','M','citizenship','UZ','birth_place','Ташкент',
      'passport_series','AB','passport_number','1234567','pinfl','12345678901234',
      'issued_by','ГУВД','issued_at','2018-01-01','expires_at','2028-01-01',
      'region_code','10','district_code','1001','locality','Ташкент','street_address','ул. Тест, 1'
    ),
    upd,
    fm
  );

  if (r->>'ok')::boolean is not true then raise exception 'approve не ok: %', r; end if;
  if (select verification_status::text from users where id = usr) <> 'approved' then
    raise exception 'юзер не approved'; end if;
  if (select state::text from verification_cases where id = cid) <> 'closed' then
    raise exception 'кейс не closed'; end if;

  select payload into ev from case_events
    where case_id = cid and action = 'decided' order by created_at desc limit 1;
  if ev is null then raise exception 'нет события decided'; end if;
  if ev->'face_match' is null or ev->'face_match' = 'null'::jsonb then
    raise exception 'face_match не записан в событие: %', ev; end if;
  if (ev->'face_match'->>'face_selfie_matches')::boolean is not true
     or (ev->'face_match'->>'liveness_ok')::boolean is not true
     or (ev->'face_match'->>'age_matches')::boolean is not false then
    raise exception 'face_match значения неверны: %', ev->'face_match'; end if;

  raise notice 'QZ-5 face_match persisted OK';
end $$;

rollback;
