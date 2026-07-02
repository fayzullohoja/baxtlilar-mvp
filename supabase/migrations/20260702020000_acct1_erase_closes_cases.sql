-- ACCT-1 — erase_user (self-delete) закрывает открытые verification_cases.
--
-- Раньше erase_user удалял профиль/фото/quiz/документы, но не трогал
-- verification_cases → у удалённого юзера оставался открытый кейс-«призрак» в
-- очереди модерации: модератор берёт его в работу, а профиль/документы уже
-- стёрты. Также это ломает VF-1-инвариант на противоположном конце.
--
-- Пересоздаём функцию целиком (тело идентично исходному из
-- 20260620920000_split_window_and_jti_fixes.sql) + один UPDATE, закрывающий
-- открытые кейсы. Кейсы НЕ удаляем — оставляем закрытыми для аудита (case_events).

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
