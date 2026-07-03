-- MATCH-1 — is_matchable = гейт «мог ли ladder легитимно показать этого человека».
-- С появлением degradation ladder (match_relax_ladder) гейт зеркалит САМЫЙ ШИРОКИЙ
-- легальный уровень (level 2): статусы + взаимный пол инвариантны, возрастное окно
-- отправителя ±5 лет (floor 18), возрастная преференция ПОЛУЧАТЕЛЯ не проверяется
-- (level 2 её снимает). Иначе юзер не смог бы отправить интерес собственному
-- «матчу дня», показанному на relax-уровне.

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

  -- одинаковый пол → нет (инвариант на всех уровнях)
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

  -- в пределах ±5 от окна отправителя (получателю ~21, окно 25-35 → eff 20-40) → ДА
  update user_profiles set birth_date = (current_date - interval '21 years' - interval '100 days')::date
    where user_id = r;
  if not is_matchable(s, r) then raise exception 'relax-окно ±5: 21-летняя должна проходить'; end if;

  -- далеко вне даже ±5 (получателю ~18 < 20) → нет
  update user_profiles set birth_date = (current_date - interval '18 years' - interval '100 days')::date
    where user_id = r;
  if is_matchable(s, r) then raise exception 'вне relax-окна не должен матчиться'; end if;
  update user_profiles set birth_date = '1997-01-01' where user_id = r;

  -- преференции ПОЛУЧАТЕЛЯ не покрывают отправителя → всё равно ДА (level 2 их снимает)
  update user_profiles set partner_age_min = 45, partner_age_max = 50 where user_id = r;
  if not is_matchable(s, r) then raise exception 'candidate-side prefs не должны блокировать (level 2)'; end if;

  raise notice 'MATCH-1 is_matchable OK';
end $$;

rollback;
