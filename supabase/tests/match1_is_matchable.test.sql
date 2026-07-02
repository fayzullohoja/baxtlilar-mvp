-- MATCH-1 — is_matchable отражает те же предикаты, что get_recommendations:
-- approved + published + взаимный пол + взаимный возрастной диапазон. Роут
-- interest вызывает её перед process_interest, чтобы нельзя было послать интерес
-- любому active-юзеру по UUID в обход matchability.

begin;

do $$
declare s uuid; r uuid;
begin
  insert into users (telegram_id, verification_status, lifecycle_state)
    values (990009300, 'approved', 'active') returning id into s;
  insert into user_profiles (user_id, gender, looking_for_gender, birth_date, partner_age_min, partner_age_max, status)
    values (s, 'm', 'f', '1995-01-01', 25, 35, 'published');

  insert into users (telegram_id, verification_status, lifecycle_state)
    values (990009301, 'approved', 'active') returning id into r;
  insert into user_profiles (user_id, gender, looking_for_gender, birth_date, partner_age_min, partner_age_max, status)
    values (r, 'f', 'm', '1997-01-01', 27, 40, 'published');

  if not is_matchable(s, r) then raise exception 'ожидалась совместимая пара'; end if;

  -- одинаковый пол → нет
  update user_profiles set gender = 'm', looking_for_gender = 'f' where user_id = r;
  if is_matchable(s, r) then raise exception 'одинаковый пол не должен матчиться'; end if;
  update user_profiles set gender = 'f', looking_for_gender = 'm' where user_id = r;

  -- не верифицирован → нет
  update users set verification_status = 'pending_review' where id = r;
  if is_matchable(s, r) then raise exception 'неверифицированный не должен матчиться'; end if;
  update users set verification_status = 'approved' where id = r;

  -- не опубликован → нет
  update user_profiles set status = 'draft' where user_id = r;
  if is_matchable(s, r) then raise exception 'неопубликованный не должен матчиться'; end if;
  update user_profiles set status = 'published' where user_id = r;

  -- вне возрастного диапазона отправителя (получателю ~20, отправитель хочет 25-35) → нет
  update user_profiles set birth_date = '2005-01-01' where user_id = r;
  if is_matchable(s, r) then raise exception 'вне возраста не должен матчиться'; end if;

  raise notice 'MATCH-1 is_matchable OK';
end $$;

rollback;
