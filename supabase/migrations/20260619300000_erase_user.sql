-- 20260619300000_erase_user.sql
-- Phase F-012 + F-114 + part of P6/P9 (security-audit 2026-06-19):
--   F-114: /api/account?action=delete делал десяток мутаций (delete/update),
--          ни одна не проверяла .error → частичный сбой возвращал {ok:true},
--          оставляя ПД в БД (нарушение права на стирание ст. 28 закона РУз).
--   F-012: cascade-удаление user_id раскидано по слою JS — единая транзакция
--          в PL/pgSQL даёт атомарность (всё или ничего) и auditability.
--   P6:    telegram_id ОСТАВАЛСЯ в строке после delete — это прямой
--          идентификатор аккаунта, фактически нарушение erasure. Колонка
--          сделана nullable, обнуляется при erase_user. Партиальный
--          UNIQUE на telegram_id (active rows) допускает множественные NULL.
--   P9:    reports.comment на target=user_id раньше НЕ очищались — там могли
--          быть ПД жертвы или третьих лиц, оставались видимы админам вечно.
--          Теперь анонимизируется и для reporter, и для target.

alter table users alter column telegram_id drop not null;

create or replace function erase_user(p_user_id uuid)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  -- Дочерние таблицы (FK→users) — полная очистка.
  delete from profile_photos where user_id = p_user_id;
  delete from user_profiles where user_id = p_user_id;
  delete from quiz_answers where user_id = p_user_id;
  delete from quiz_results where user_id = p_user_id;
  delete from consents where user_id = p_user_id;
  delete from user_documents where user_id = p_user_id;
  delete from daily_request_quotas where user_id = p_user_id;
  delete from otp_codes where user_id = p_user_id;

  -- match_views: удаляемый как viewer (он сам видел кого-то — это его
  -- собственный навигационный след).
  delete from match_views where viewer_id = p_user_id;

  -- match_requests: висящие → отзыв (исходящие) / декайн (входящие).
  -- Принятые/declined оставляем — это история второй стороны.
  update match_requests
     set status = 'withdrawn'
   where sender_id = p_user_id and status = 'pending';
  update match_requests
     set status = 'declined'
   where receiver_id = p_user_id and status = 'pending';

  -- Свободный текст пользователя (содержит ПД): сообщения, заметка интереса,
  -- комментарий жалобы. И комментарий ЧУЖОЙ жалобы НА удаляемого (там тоже
  -- могут быть его ПД — P9).
  update chat_messages set body = '[удалено]' where sender_id = p_user_id;
  update match_requests set message = null where sender_id = p_user_id;
  update reports set comment = null where reporter_id = p_user_id;
  update reports set comment = null where target_user_id = p_user_id;

  -- Анонимизация основной строки. telegram_id обнуляется (P6 — это прямой
  -- идентификатор аккаунта Telegram). lifecycle_state переводит во второй
  -- транзакции, через transition_user — там свой аудит.
  update users
     set deleted_at = now(),
         telegram_id = null,
         phone_number = null,
         phone_verified = false,
         telegram_username = null,
         telegram_first_name = null,
         telegram_last_name = null
   where id = p_user_id;
end;
$$;
