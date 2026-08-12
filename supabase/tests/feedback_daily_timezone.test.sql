-- Витрина отзывов по дням - граница суток обязана быть по Asia/Tashkent, а не по
-- часовому поясу того, кто читает.
--
-- date_trunc('day', created_at) над timestamptz считает день по TimeZone сессии.
-- На сервере с TimeZone=UTC отзыв, оставленный в 2 часа ночи по Ташкенту,
-- уезжает во вчерашний день и портит среднюю оценку сразу за двое суток, а
-- вечерне-ночная активность для этого приложения - основная масса, не край.
-- Плюс одна и та же витрина отдаёт разные числа датасорсу Grafana и psql с VPS.
--
-- Поэтому тест проверяет ДВА пояса и требует совпадения: под одним поясом
-- сломанная витрина проходит случайно и не доказывает ничего.

begin;

do $$
declare
  uid uuid;
  v_utc text;
  v_tsh text;
  -- 10.08 по Ташкенту: оценки 1, 5, 4 - средняя 3.33. 11.08: одна оценка 2.
  -- Сломанная витрина под UTC отдаёт одну строку 2026-08-10 с четырьмя
  -- отзывами и средней 3.00: ночной отзыв 11.08 02:00+05 в UTC ещё вчерашний.
  v_expected text := '2026-08-10=3/3.33|2026-08-11=1/2.00';
begin
  insert into users (telegram_id, verification_status, lifecycle_state)
    values (990011301, 'approved', 'active') returning id into uid;

  -- Пишем в таблицу напрямую: create_feedback ставит created_at = now() и
  -- задать пограничное время через неё нельзя. Литералы с явным +05 читаются
  -- одинаково при любом TimeZone сессии, так что фикстура не плывёт.
  insert into feedback (user_id, rating, created_at) values
    (uid, 1, '2026-08-10 10:00+05'),
    (uid, 5, '2026-08-10 12:00+05'),
    (uid, 4, '2026-08-10 23:30+05'),
    (uid, 2, '2026-08-11 02:00+05');

  -- Только фикстурные даты: у остальных строк базы created_at = сегодня, и
  -- попади они в выборку - тест начал бы падать от чужих данных, а не от бага.
  perform set_config('timezone', 'UTC', true);
  select string_agg(day::text || '=' || feedback_count || '/' || avg_rating, '|' order by day)
    into v_utc
    from analytics.v_feedback_daily
   where day in (date '2026-08-10', date '2026-08-11');

  perform set_config('timezone', 'Asia/Tashkent', true);
  select string_agg(day::text || '=' || feedback_count || '/' || avg_rating, '|' order by day)
    into v_tsh
    from analytics.v_feedback_daily
   where day in (date '2026-08-10', date '2026-08-11');

  if v_utc is distinct from v_tsh then
    raise exception 'v_feedback_daily зависит от TimeZone клиента: UTC дал %, Asia/Tashkent дал %',
      coalesce(v_utc, '(пусто)'), coalesce(v_tsh, '(пусто)');
  end if;

  if v_tsh is distinct from v_expected then
    raise exception 'v_feedback_daily разложила отзывы по дням не по Ташкенту: ожидалось %, получено %',
      v_expected, coalesce(v_tsh, '(пусто)');
  end if;

  raise notice 'feedback: сутки витрины по Asia/Tashkent при любом TimeZone OK';
end $$;

rollback;
