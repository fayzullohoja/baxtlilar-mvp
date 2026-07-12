-- approve_verification исправляет user_profiles (birth_date+gender) по паспорту
-- и пишет коррекции в decided-событие.
do $$
declare
  v_admin uuid; v_user uuid; v_case uuid; v_upd timestamptz;
  v_payload jsonb; v_res jsonb; v_ev jsonb;
  v_new_birth date; v_new_gender text;
begin
  delete from admin_users where login = 'vcp_admin';
  insert into admin_users(login, role, password_hash, active)
    values ('vcp_admin', 'superadmin', 'scrypt$a$b', true) returning id into v_admin;

  insert into users(telegram_id, lifecycle_state, verification_status)
    values (900100001, 'active', 'pending_review') returning id into v_user;
  -- анкета с ЛОЖНЫМИ данными: сам написал 1998 / женщина
  insert into user_profiles(user_id, display_name, gender, birth_date, status)
    values (v_user, 'Лжец', 'f', date '1998-01-01', 'published');

  -- VF-1 триггер уже создал открытый кейс на pending_review — берём его,
  -- переводим в data_entry и назначаем на админа (второй insert = конфликт
  -- one_open_per_user).
  select id into v_case from verification_cases where user_id = v_user and state <> 'closed' limit 1;
  update verification_cases set state = 'data_entry', assignee_id = v_admin where id = v_case;
  select updated_at into v_upd from verification_cases where id = v_case;

  -- паспорт (истина): 2005-11-11, мужчина
  v_payload := jsonb_build_object(
    'last_name','Zayush','first_name','Zayush','middle_name','Zayush',
    'birth_date','2005-11-11','gender','M','citizenship','UZ','birth_place','Ташкент',
    'passport_series','AA','passport_number','1111111','pinfl','11111111111111',
    'issued_by','ОВД','issued_at','2001-11-11','expires_at','2030-10-01',
    'region_code','UZ-TAS','district_code','UZ-TAS-YN','locality','Ташкент','street_address','ул. 1');

  v_res := admin_approve_verification(v_case, v_admin, v_payload, v_upd, null);
  assert (v_res->>'ok')::boolean, format('approve should ok: %s', v_res);

  -- профиль исправлен по паспорту
  select birth_date, gender into v_new_birth, v_new_gender from user_profiles where user_id = v_user;
  assert v_new_birth = date '2005-11-11', format('birth must be corrected to passport, got %s', v_new_birth);
  assert v_new_gender = 'm', format('gender must be corrected to passport m, got %s', v_new_gender);

  -- коррекции записаны в decided-событие (аудит)
  select payload into v_ev from case_events where case_id = v_case and action = 'decided' order by created_at desc limit 1;
  assert v_ev->'profile_corrections'->'birth_date'->>'from' = '1998-01-01', format('audit birth from: %s', v_ev);
  assert v_ev->'profile_corrections'->'birth_date'->>'to' = '2005-11-11', 'audit birth to';
  assert v_ev->'profile_corrections'->'gender'->>'from' = 'f', 'audit gender from';
  assert v_ev->'profile_corrections'->'gender'->>'to' = 'm', 'audit gender to';

  -- Полностью удаляем тест-юзера (общая ephemeral-БД — иначе сдвинем counts в
  -- соседних тестах). case_events append-only → на время cascade-delete глушим
  -- триггер (как admin_hard_delete_user; тест бежит владельцем БД).
  alter table case_events disable trigger case_events_no_update;
  delete from users where id = v_user;
  alter table case_events enable trigger case_events_no_update;

  raise notice '✓ approve corrects profile from passport + audits it';
end$$;
