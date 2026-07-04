-- DB-5 — sargable возрастной фильтр в get_recommendations должен возвращать
-- ТОТ ЖЕ набор, что и старый age()-предикат, включая точные границы дней рождения.
-- Тест держит все прочие фильтры пройденными и варьирует только birth_date.

begin;

do $$
declare
  viewer uuid; c uuid;
  got uuid[]; ref uuid[];
  tg bigint := 990009910;
  edges record;
begin
  -- viewer: m, ищет f, окно 25-30; свой возраст 30, окна кандидатов широкие → решает только возраст кандидата
  insert into users (telegram_id, verification_status, lifecycle_state)
    values (990009900, 'approved', 'active') returning id into viewer;
  insert into user_profiles (user_id, gender, looking_for_gender, birth_date, partner_age_min, partner_age_max, status)
    values (viewer, 'm', 'f', (current_date - interval '30 years' - interval '100 days')::date, 25, 30, 'published');

  -- кандидатки на точных границах возраста (все проходят прочие фильтры)
  for edges in
    select * from (values
      (make_interval(years => 25),                         'ровно 25 сегодня'),
      (make_interval(years => 25) - interval '1 day',      '25 и 1 день'),
      (make_interval(years => 25) + interval '1 day',      'без дня 25 = 24'),
      (make_interval(years => 27),                         '27 середина'),
      (make_interval(years => 30),                         'ровно 30'),
      (make_interval(years => 31) - interval '1 day',      'без дня 31 = 30'),
      (make_interval(years => 31),                         'ровно 31 = вне'),
      (make_interval(years => 31) + interval '1 day',      '31 и день = вне'),
      (make_interval(years => 20),                         '20 вне снизу'),
      (make_interval(years => 40),                         '40 вне сверху')
    ) as t(off_iv, label)
  loop
    tg := tg + 1;
    insert into users (telegram_id, verification_status, lifecycle_state)
      values (tg, 'approved', 'active') returning id into c;
    insert into user_profiles (user_id, gender, looking_for_gender, birth_date, partner_age_min, partner_age_max, status)
      values (c, 'f', 'm', (current_date - edges.off_iv)::date, 18, 99, 'published');
    insert into profile_photos (user_id, path, status, is_main) values (c, 'p.jpg', 'approved', true);
  end loop;

  -- набор из sargable-функции
  select coalesce(array_agg(user_id order by user_id), '{}') into got
  from get_recommendations(viewer, 1000, 0);

  -- эталон: тот же набор фильтров, но возраст через age() (как было до DB-5)
  select coalesce(array_agg(cp.user_id order by cp.user_id), '{}') into ref
  from user_profiles cp
  join users cu on cu.id = cp.user_id
  where cp.user_id <> viewer
    and cu.lifecycle_state = 'active'
    and cu.verification_status = 'approved'
    and cp.status = 'published'
    and cp.gender = 'f' and cp.looking_for_gender = 'm'
    and date_part('year', age(cp.birth_date))::int between 25 and 30
    and 30 between cp.partner_age_min and cp.partner_age_max
    and exists (select 1 from profile_photos pp where pp.user_id = cp.user_id and pp.status = 'approved');

  if got is distinct from ref then
    raise exception 'DB-5 set mismatch: sargable=% age()=%', got, ref;
  end if;
  if array_length(got, 1) is null or array_length(got, 1) < 4 then
    raise exception 'DB-5: ожидалось >=4 в окне (25/25-1d/27/30/31-1d), got=%', got;
  end if;

  raise notice 'DB-5 sargable age set-equality OK (% в окне)', array_length(got,1);
end $$;

rollback;
