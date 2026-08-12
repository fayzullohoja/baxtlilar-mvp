-- Отзывы - дедуп двойного тапа и скриншот.
--
-- Ключ дедупа - человек, оценка и текст в пределах минуты; скриншот в него не
-- входит. Значит вторая отправка со скриншотом попадает на СТАРУЮ запись, и
-- если её не тронуть, файл уже лежит в бакете, а указателя на него в базе нет:
-- человек слышит благодарность, модератор скриншота не видит никогда. Ровно так
-- выглядит и повтор после ответа "скриншот приложить не удалось".
--
-- Поэтому процедура обязана, во-первых, прикреплять принесённый файл к найденной
-- записи, если своего у неё нет, и во-вторых - говорить вызывающему, что именно
-- случилось: без этого роут не может ни показать скриншот модератору, ни снести
-- осиротевший файл (сборщика таких файлов в проекте нет).

begin;

do $$
declare
  uid uuid;
  r record;
  v_first uuid;
  v_path text;
  n int;
begin
  insert into users (telegram_id, verification_status, lifecycle_state)
    values (990011301, 'approved', 'active') returning id into uid;

  -- 1) Обычная вставка без скриншота.
  select * into r from create_feedback(uid, 4, null, null, 'ru');
  if r.feedback_id is null or r.limited then
    raise exception 'первая отправка не записалась: %', r;
  end if;
  if r.deduplicated then
    raise exception 'первая отправка помечена дедупом';
  end if;
  if r.screenshot_stored then
    raise exception 'скриншота не присылали, а процедура говорит, что сохранила его';
  end if;
  v_first := r.feedback_id;

  -- 2) Тот же человек, та же оценка, тот же (пустой) текст в пределах минуты,
  -- но теперь со скриншотом: это дедуп, и файл обязан доехать до старой записи.
  select * into r from create_feedback(uid, 4, null, uid || '/2.png', 'ru');
  if r.feedback_id <> v_first then
    raise exception 'дедуп не сработал - появился дубль отзыва';
  end if;
  if not r.deduplicated then
    raise exception 'дедуп не отличим от вставки - роут сочтёт отправку новой записью';
  end if;
  if not r.screenshot_stored then
    raise exception 'скриншот прикреплён к записи, но процедура зовёт его несохранённым - роут снесёт файл, на который ссылается база';
  end if;

  select screenshot_path into v_path from feedback where id = v_first;
  if v_path is distinct from (uid || '/2.png') then
    raise exception 'скриншот повторной отправки не прикрепился к записи: %', coalesce(v_path, '(пусто)');
  end if;

  select count(*) into n from feedback where user_id = uid;
  if n <> 1 then
    raise exception 'после дедупа записей стало %, а должна остаться одна', n;
  end if;

  -- 3) Ещё один дедуп, но у записи скриншот уже есть: чужой файл не затираем,
  -- а вызывающему честно говорим, что присланный не пригодился.
  select * into r from create_feedback(uid, 4, null, uid || '/3.png', 'ru');
  if not r.deduplicated then
    raise exception 'третья отправка не помечена дедупом';
  end if;
  if r.screenshot_stored then
    raise exception 'процедура выдала за сохранённый файл, который никуда не записан - он осиротеет';
  end if;
  select screenshot_path into v_path from feedback where id = v_first;
  if v_path is distinct from (uid || '/2.png') then
    raise exception 'дедуп затёр уже прикреплённый скриншот: %', coalesce(v_path, '(пусто)');
  end if;

  -- 4) Новая вставка со скриншотом (другая оценка - мимо ключа дедупа).
  select * into r from create_feedback(uid, 5, 'всё понравилось', uid || '/4.png', 'ru');
  if r.deduplicated or r.limited then
    raise exception 'отзыв с другой оценкой обязан стать новой записью: %', r;
  end if;
  if not r.screenshot_stored then
    raise exception 'скриншот новой записи не засчитан сохранённым';
  end if;

  -- 5) Суточный лимит. Ветка тоже отвечает вызывающему про скриншот: файл
  -- отброшенной отправки роут обязан снести, а не оставить на диске.
  perform * from create_feedback(uid, 3, 'третий за сутки', null, 'ru');
  select * into r from create_feedback(uid, 2, 'четвёртый за сутки', uid || '/5.png', 'ru');
  if not r.limited then
    raise exception 'суточный лимит не сработал';
  end if;
  if r.deduplicated or r.screenshot_stored then
    raise exception 'отбитая лимитом отправка помечена как записанная: %', r;
  end if;

  raise notice 'feedback: дедуп и скриншот OK';
end $$;

rollback;
