-- Отзывы - неквалифицированное имя feedback в теле create_feedback не должно
-- перехватываться временной схемой вызывающего.
--
-- Механика: если pg_temp не назван в search_path явно, Postgres ищет его
-- ПЕРВЫМ для отношений. Вызывающий создаёт у себя temp table feedback - и все
-- запросы внутри процедуры уходят в неё: отзыв не сохраняется, суточный лимит
-- обнуляется, а на security definer этим же приёмом выполняется чужой код с
-- правами владельца функции.
--
-- Файл отдельный НАМЕРЕННО: plpgsql кеширует планы на сессию, а харнесс даёт
-- одну сессию на файл - вызов create_feedback из соседнего теста закешировал бы
-- план по настоящей таблице и спрятал бы подмену.

begin;

-- Копия структуры public.feedback во временной схеме - ровно то, что может
-- сделать любая роль с правом TEMPORARY (оно у PUBLIC по умолчанию).
create temp table feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  rating smallint,
  body text,
  screenshot_path text,
  locale text,
  created_at timestamptz not null default now()
);

do $$
declare
  uid uuid;
  n_public int;
  n_temp int;
begin
  insert into users (telegram_id, verification_status, lifecycle_state)
    values (990011101, 'approved', 'active') returning id into uid;

  perform * from create_feedback(uid, 4, 'отзыв мимо подменённой таблицы', null, 'ru');

  select count(*) into n_public from public.feedback where user_id = uid;
  select count(*) into n_temp from pg_temp.feedback where user_id = uid;

  if n_public <> 1 or n_temp <> 0 then
    raise exception 'create_feedback пишет в подменённую временную таблицу (public=%, pg_temp=%)',
      n_public, n_temp;
  end if;

  raise notice 'feedback: search_path устойчив к pg_temp OK';
end $$;

rollback;
