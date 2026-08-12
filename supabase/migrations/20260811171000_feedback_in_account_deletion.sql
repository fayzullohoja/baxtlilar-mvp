-- Отзыв обязан исчезать вместе с аккаунтом - обеими дорогами удаления.
--
-- Таблица feedback появилась в 20260811170000 с on delete cascade на user_id, и
-- на этом всё: ни одна из двух дорог удаления до неё не дотягивается.
--
-- 1) Самоудаление (erase_user) строку users НЕ удаляет, а обезличивает
--    (deleted_at, lifecycle_state='deleted', telegram_id/phone_number=null),
--    поэтому каскад не срабатывает НИКОГДА. В базе навсегда оставались текст
--    отзыва (до 1000 символов свободного текста, где по спеке бывают чужие
--    имена и обстоятельства) и путь к скриншоту - модератор продолжал видеть их
--    в разделе отзывов после того, как человек удалил аккаунт. Рядом в той же
--    функции весь остальной свободный текст глушится явно (chat_messages.body,
--    match_requests.message, reports.comment), то есть инвариант в проекте есть,
--    и новая таблица просто из него выпала.
--
--    Глушим текст и путь, а строку с оценкой ОСТАВЛЯЕМ - ровно как поступают
--    соседние строки функции с reports: их не удаляют, у них обнуляют comment.
--    Персональных данных в оценке 1-5 нет, а витрины отзывов не теряют историю
--    из-за одного удалённого аккаунта. Файл скриншота сносит роут /api/account,
--    и обнуление пути ему не мешает: он обходит папку человека в бакете, а не
--    читает screenshot_path. Обходом, потому что часть файлов в базе не значится
--    вовсе - путь доезжает до неё не всегда (файл кладётся до create_feedback, и
--    суточный лимит, дедуп двойного тапа или обрыв запроса оставляют его без
--    записи), а такой файл обязан уйти вместе с аккаунтом наравне с остальными.
--
-- 2) Полное удаление (admin_hard_delete_user) собирает пути файлов ДО удаления
--    строк - после каскада указателя на файл не остаётся вовсе. Список собирался
--    из profile_photos, user_documents и users.avatar_path, про
--    feedback.screenshot_path он не знал, и скриншот (по спеке - материал уровня
--    паспорта, виден только в админке) оставался на диске навсегда: строки с
--    путём больше нет, сборщика осиротевших файлов в проекте нет, а
--    housekeeping-крон делает три GC по базе и в бакеты не заглядывает.
--
-- Обе функции пересоздаются целиком: тела идентичны последним версиям
-- (20260702020000 и 20260704060000), добавлено по одной правке в каждую.
-- Атрибуты сохранены как были - erase_user остаётся security invoker, а
-- admin_hard_delete_user остаётся security definer, потому что ему нужны права
-- владельца, чтобы отключить append-only триггер case_events.

create or replace function erase_user(p_user_id uuid)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  insert into document_sha_blacklist(sha256, kind, source_user_id, reason)
  select passport_sha256, 'passport', p_user_id, 'self_delete'
    from user_documents
   where user_id = p_user_id and passport_sha256 is not null
  on conflict (sha256, kind, source_user_id, reason) do nothing;

  insert into document_sha_blacklist(sha256, kind, source_user_id, reason)
  select selfie_sha256, 'selfie', p_user_id, 'self_delete'
    from user_documents
   where user_id = p_user_id and selfie_sha256 is not null
  on conflict (sha256, kind, source_user_id, reason) do nothing;

  -- ACCT-1: закрыть открытые кейсы верификации, чтобы удалённый юзер не висел
  -- «призраком» в очереди модерации.
  update verification_cases
     set state = 'closed'
   where user_id = p_user_id and state <> 'closed';

  delete from profile_photos where user_id = p_user_id;
  delete from user_profiles where user_id = p_user_id;
  delete from quiz_answers where user_id = p_user_id;
  delete from quiz_results where user_id = p_user_id;
  delete from consents where user_id = p_user_id;
  delete from user_documents where user_id = p_user_id;
  delete from daily_request_quotas where user_id = p_user_id;
  delete from otp_codes where user_id = p_user_id;

  delete from match_views where viewer_id = p_user_id;

  update match_requests
     set status = 'withdrawn'
   where sender_id = p_user_id and status = 'pending';
  update match_requests
     set status = 'declined'
   where receiver_id = p_user_id and status = 'pending';

  update chat_messages set body = '[удалено]' where sender_id = p_user_id;
  update match_requests set message = null where sender_id = p_user_id;
  update reports set comment = null where reporter_id = p_user_id;
  update reports set comment = null where target_user_id = p_user_id;
  -- Отзыв о приложении - тот же свободный текст, что строчкой выше, плюс
  -- указатель на скриншот с чужой анкетой. Строку оставляем ради оценки.
  update feedback set body = null, screenshot_path = null where user_id = p_user_id;

  update users
     set deleted_at      = now(),
         lifecycle_state = 'deleted',
         telegram_id     = null,
         phone_number    = null,
         phone_verified  = false,
         telegram_username   = null,
         telegram_first_name = null,
         telegram_last_name  = null,
         updated_at      = now()
   where id = p_user_id;

  insert into user_state_transitions
    (user_id, field, from_value, to_value, reason, triggered_by_kind, triggered_by_id)
  values
    (p_user_id, 'lifecycle_state', null, 'deleted',
     'user deleted account (atomic erase)', 'user', p_user_id::text);
end;
$$;

create or replace function admin_hard_delete_user(
  p_user_id uuid,
  p_admin_id uuid,
  p_reason text default null
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_state text; v_paths text[];
begin
  select lifecycle_state into v_state from users where id = p_user_id for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;

  select coalesce(array_agg(x), '{}') into v_paths from (
    select path as x from profile_photos where user_id = p_user_id
    union all select passport_path from user_documents where user_id = p_user_id and passport_path is not null
    union all select selfie_path from user_documents where user_id = p_user_id and selfie_path is not null
    union all select avatar_path from users where id = p_user_id and avatar_path is not null
    -- Скриншот отзыва: через несколько строк указатель на него снесёт каскад,
    -- поэтому путь забираем сейчас. Основную работу делает не этот union, а
    -- обход папки бакета в роуте: путь скриншота доезжает до базы не всегда
    -- (файл кладётся до create_feedback, и суточный лимит, дедуп двойного тапа
    -- или обрыв запроса оставляют его без записи), так что список отсюда для
    -- бакета отзывов заведомо неполон. Оставлен второй линией: путь, который в
    -- базе всё-таки есть, уедет в storage.remove даже если обход папки упадёт.
    union all select screenshot_path from feedback where user_id = p_user_id and screenshot_path is not null
  ) t;

  insert into admin_audit_log(admin_id, action, entity, entity_id, reason, new_value)
  values (p_admin_id, 'hard_delete_user', 'user', p_user_id::text, p_reason,
          jsonb_build_object('prev_state', v_state));

  alter table case_events disable trigger case_events_no_update;
  delete from users where id = p_user_id;  -- FK on delete cascade сносит всех детей
  alter table case_events enable trigger case_events_no_update;

  return jsonb_build_object('ok', true, 'storage_paths', to_jsonb(v_paths));
end;
$$;
