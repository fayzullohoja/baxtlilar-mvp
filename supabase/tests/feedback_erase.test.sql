-- Отзывы и удаление аккаунта - обе дороги удаления обязаны дотягиваться до
-- отзыва: в нём свободный текст (по спеке там бывают чужие имена и
-- обстоятельства) и путь к скриншоту с чужой анкетой.
--
-- 1) Самоудаление (erase_user) строку users НЕ удаляет, а обезличивает -
--    поэтому on delete cascade у feedback.user_id не срабатывает НИКОГДА, и
--    текст с путём скриншота остаются видны модератору после удаления.
-- 2) Полное удаление (admin_hard_delete_user) сносит строку каскадом вместе с
--    единственным указателем на файл - если путь не собран ДО удаления,
--    скриншот остаётся на диске навсегда и найти его уже нечем.

begin;

do $$
declare
  adm uuid;
  u1 uuid;
  u2 uuid;
  r jsonb;
  v_body text;
  v_path text;
  v_rating int;
begin
  -- ── самоудаление: текст и путь глушим, оценку оставляем ────────────────────
  insert into users (telegram_id, verification_status, lifecycle_state)
    values (990011201, 'approved', 'active') returning id into u1;
  perform * from create_feedback(u1, 5, 'отзыв с чужими именами', u1 || '/shot.png', 'ru');

  perform erase_user(u1);

  select body, screenshot_path, rating into v_body, v_path, v_rating
    from feedback where user_id = u1;
  if v_rating is null then
    raise exception 'erase_user удалил строку отзыва целиком - оценка нужна витринам';
  end if;
  if v_body is not null then
    raise exception 'erase_user оставил текст отзыва: %', v_body;
  end if;
  if v_path is not null then
    raise exception 'erase_user оставил путь скриншота: %', v_path;
  end if;
  if v_rating <> 5 then
    raise exception 'erase_user испортил оценку: %', v_rating;
  end if;

  -- ── полное удаление: путь скриншота обязан приехать роуту на чистку ────────
  insert into admin_users (login, role, password_hash)
    values ('t_feedback', 'superadmin', 'x') returning id into adm;
  insert into users (telegram_id, verification_status, lifecycle_state)
    values (990011202, 'approved', 'active') returning id into u2;
  perform * from create_feedback(u2, 2, 'отзыв со скриншотом', u2 || '/shot.png', 'ru');

  r := admin_hard_delete_user(u2, adm, 'test');
  if (r->>'ok')::boolean is not true then
    raise exception 'hard-delete не прошёл: %', r;
  end if;
  if not (r->'storage_paths' ? (u2 || '/shot.png')) then
    raise exception 'hard-delete не вернул путь скриншота отзыва - файл осиротеет: %',
      r->'storage_paths';
  end if;

  raise notice 'feedback: обе дороги удаления дотягиваются до отзыва OK';
end $$;

rollback;
