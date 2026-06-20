-- 20260620800000_final_adversarial_fixes.sql
-- Final adversarial sweep (workflow wmil96145): закрывает HIGH SQL-уровня.
--   H8: erase_user атомарный (lifecycle transition внутри той же функции).
--   C1: erase_user пишет document_sha_blacklist self-delete tombstone.
--   H9: admin_blocking_reject derives phone_hash + sha256 ВНУТРИ RPC из БД
--       (вместо trust JS-route'у). Compromised route больше не может скрыть
--       tombstone passing null.
--   H10: admin_unblock_verification fallback `linked_user_id IS NULL AND
--       phone_hash=$` удалён — не стираем чужие legacy tombstone'ы.
--   H12 (частично): consents UNIQUE(user_id,consent_type,consent_version)
--       для ON CONFLICT DO NOTHING — bot recordConsent идемпотентен.

-- =============================================================================
--  C1+H8: erase_user атомарный + sha-blacklist self-delete tombstone
-- =============================================================================
create or replace function erase_user(p_user_id uuid)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  -- C1: ДО удаления user_documents — снимок sha в append-only blacklist.
  -- catfish одобренного аккаунта мог удалить себя → user_documents.DELETE →
  -- sha-dedup не ловил его дубликаты. Self-delete tombstone закрывает.
  insert into document_sha_blacklist(sha256, kind, source_user_id, reason)
  select passport_sha256, 'passport', p_user_id, 'self_delete'
    from user_documents
   where user_id = p_user_id and passport_sha256 is not null
  on conflict (sha256, kind) do nothing;
  insert into document_sha_blacklist(sha256, kind, source_user_id, reason)
  select selfie_sha256, 'selfie', p_user_id, 'self_delete'
    from user_documents
   where user_id = p_user_id and selfie_sha256 is not null
  on conflict (sha256, kind) do nothing;

  -- Дочерние таблицы (FK→users) — полная очистка.
  delete from profile_photos where user_id = p_user_id;
  delete from user_profiles where user_id = p_user_id;
  delete from quiz_answers where user_id = p_user_id;
  delete from quiz_results where user_id = p_user_id;
  delete from consents where user_id = p_user_id;
  delete from user_documents where user_id = p_user_id;
  delete from daily_request_quotas where user_id = p_user_id;
  delete from otp_codes where user_id = p_user_id;

  -- match_views: удаляемый как viewer.
  delete from match_views where viewer_id = p_user_id;

  -- match_requests: висящие → отзыв (исходящие) / декайн (входящие).
  update match_requests
     set status = 'withdrawn'
   where sender_id = p_user_id and status = 'pending';
  update match_requests
     set status = 'declined'
   where receiver_id = p_user_id and status = 'pending';

  -- Свободный текст пользователя (содержит ПД).
  update chat_messages set body = '[удалено]' where sender_id = p_user_id;
  update match_requests set message = null where sender_id = p_user_id;
  update reports set comment = null where reporter_id = p_user_id;
  update reports set comment = null where target_user_id = p_user_id;

  -- H8: lifecycle_state перевод ВНУТРИ функции — больше нет split-window
  -- между app tryTransition и erase_user. statement_timeout/deadlock между
  -- двумя транзакциями раньше оставлял row с lifecycle='deleted' и
  -- telegram_id=T → partial UNIQUE WHERE deleted_at IS NULL допускал INSERT
  -- → две row с одним telegram_id.
  update users
     set deleted_at      = now(),
         lifecycle_state = 'deleted',
         telegram_id     = null,
         phone_number    = null,
         phone_verified  = false,
         telegram_username   = null,
         telegram_first_name = null,
         telegram_last_name  = null
   where id = p_user_id;

  -- user_state_transitions: запись о финальном переходе.
  insert into user_state_transitions
    (user_id, field, from_value, to_value, reason, triggered_by_kind, triggered_by_id)
  values
    (p_user_id, 'lifecycle_state', null, 'deleted',
     'user deleted account (atomic erase)', 'user', p_user_id::text);
end;
$$;

-- =============================================================================
--  H9: admin_blocking_reject derives phone_hash и sha256 ВНУТРИ RPC
--  Внешний phone_hash больше не принимаем — route мог бы передать null и
--  скрыть tombstone (audit-log poisoning + R7 bypass). Сейчас RPC сам
--  READ'ит users.phone_number и user_documents.{passport,selfie}_sha256.
--  phone_hash считаем через pgcrypto.hmac (нужно поставить extension).
-- =============================================================================
create extension if not exists pgcrypto;

-- Domain-separated phone hashing matching identity/hashing.ts:
--   HMAC-SHA256(SESSION_SECRET, "phone:v1:" + phone)
-- SESSION_SECRET берётся из current_setting('app.session_secret', true) —
-- задаётся на уровне SQL-сессии. Если не задан — fail-closed, RPC возвращает
-- error 'session_secret_not_configured'.
create or replace function admin_blocking_reject(
  p_user_id              uuid,
  p_admin_id             uuid,
  p_reason               text,
  p_phone_until_at       timestamptz,
  p_expected_updated_at  timestamptz
) returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_user users%rowtype;
  v_doc user_documents%rowtype;
  v_new_updated timestamptz := now();
  v_phone_hash text;
  v_session_secret text;
begin
  if p_admin_id is null then
    return jsonb_build_object('ok', false, 'error', 'admin_id_required');
  end if;
  if p_reason is null or length(btrim(p_reason)) = 0 then
    return jsonb_build_object('ok', false, 'error', 'reason_required');
  end if;

  select * into v_user from users where id = p_user_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if v_user.updated_at <> p_expected_updated_at then
    return jsonb_build_object('ok', false, 'error', 'conflict');
  end if;
  if v_user.verification_status <> 'pending_review' then
    return jsonb_build_object('ok', false, 'error', 'not_pending',
                              'current', v_user.verification_status);
  end if;

  select * into v_doc from user_documents where user_id = p_user_id for update;

  -- Read SESSION_SECRET from PG GUC. Set per-connection from app:
  --   SELECT set_config('app.session_secret', $SECRET, false)
  v_session_secret := current_setting('app.session_secret', true);
  if v_session_secret is null or length(v_session_secret) = 0 then
    return jsonb_build_object('ok', false, 'error', 'session_secret_not_configured');
  end if;

  -- Phone hash из БД (а не от route — H9 trust boundary).
  if v_user.phone_number is not null then
    v_phone_hash := encode(
      hmac('phone:v1:' || v_user.phone_number, v_session_secret, 'sha256'),
      'hex'
    );
  end if;

  update users set
    verification_status = 'rejected',
    onboarding_step     = 'verification_rejected',
    updated_at          = v_new_updated
  where id = p_user_id;

  insert into user_state_transitions
    (user_id, field, from_value, to_value, reason, triggered_by_kind, triggered_by_id)
  values
    (p_user_id, 'verification_status',
     v_user.verification_status::text, 'rejected',
     'blocking_reject: ' || p_reason, 'admin', p_admin_id::text),
    (p_user_id, 'onboarding_step',
     v_user.onboarding_step::text, 'verification_rejected',
     'blocking_reject: ' || p_reason, 'admin', p_admin_id::text);

  update user_documents set
    status            = 'rejected',
    reject_category   = 'blocking',
    reject_reason     = p_reason,
    reject_target     = null,
    moderated_by      = p_admin_id::text,
    moderated_at      = v_new_updated
  where user_id = p_user_id;

  if v_phone_hash is not null then
    insert into phone_blacklist(phone_hash, until_at, reason, linked_user_id)
    values (v_phone_hash, p_phone_until_at, 'verification_blocking_reject', p_user_id);
  end if;

  if v_doc.passport_sha256 is not null then
    insert into document_sha_blacklist(sha256, kind, source_user_id, reason)
    values (v_doc.passport_sha256, 'passport', p_user_id, 'verification_blocking_reject')
    on conflict (sha256, kind) do nothing;
  end if;
  if v_doc.selfie_sha256 is not null then
    insert into document_sha_blacklist(sha256, kind, source_user_id, reason)
    values (v_doc.selfie_sha256, 'selfie', p_user_id, 'verification_blocking_reject')
    on conflict (sha256, kind) do nothing;
  end if;

  return jsonb_build_object(
    'ok', true,
    'phone_tombstone_written', v_phone_hash is not null,
    'updated_at', v_new_updated
  );
end;
$$;

-- =============================================================================
--  H10: admin_unblock_verification без fallback по phone_hash
--  Раньше fallback `linked_user_id IS NULL AND phone_hash=$` мог удалить
--  чужие legacy tombstone'ы с совпадающим хешем. Теперь только linked_user_id.
-- =============================================================================
create or replace function admin_unblock_verification(
  p_user_id              uuid,
  p_admin_id             uuid,
  p_expected_updated_at  timestamptz
) returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_user users%rowtype;
  v_doc_row user_documents%rowtype;
  v_new_updated timestamptz := now();
  v_phone_deleted integer := 0;
  v_sha_deleted integer := 0;
begin
  if p_admin_id is null then
    return jsonb_build_object('ok', false, 'error', 'admin_id_required');
  end if;

  select * into v_user from users where id = p_user_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if v_user.updated_at <> p_expected_updated_at then
    return jsonb_build_object('ok', false, 'error', 'conflict');
  end if;
  if v_user.verification_status <> 'rejected' then
    return jsonb_build_object('ok', false, 'error', 'not_rejected',
                              'current', v_user.verification_status);
  end if;
  if v_user.lifecycle_state <> 'onboarding' then
    return jsonb_build_object('ok', false, 'error', 'wrong_lifecycle',
                              'current', v_user.lifecycle_state);
  end if;

  select * into v_doc_row from user_documents where user_id = p_user_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'no_documents');
  end if;
  if coalesce(v_doc_row.reject_category, '') <> 'blocking' then
    return jsonb_build_object('ok', false, 'error', 'not_blocking',
                              'current', v_doc_row.reject_category);
  end if;

  update users set
    verification_status = 'pending_review',
    onboarding_step     = 'moderation_pending',
    updated_at          = v_new_updated
  where id = p_user_id;

  insert into user_state_transitions
    (user_id, field, from_value, to_value, reason, triggered_by_kind, triggered_by_id)
  values
    (p_user_id, 'verification_status', 'rejected', 'pending_review',
     'admin: blocking-reject revoked', 'admin', p_admin_id::text),
    (p_user_id, 'onboarding_step', 'verification_rejected', 'moderation_pending',
     'admin: blocking-reject revoked', 'admin', p_admin_id::text);

  update user_documents set
    status            = 'pending_review',
    reject_category   = null,
    reject_reason     = null,
    reject_target     = null,
    moderated_by      = null,
    moderated_at      = null
  where user_id = p_user_id;

  -- H10: только linked_user_id. Legacy rows без linked_user_id остаются (их
  -- backfill — отдельная миграция, безопаснее держать чем удалять чужие).
  with deleted as (
    delete from phone_blacklist where linked_user_id = p_user_id returning 1
  )
  select count(*) into v_phone_deleted from deleted;

  with deleted as (
    delete from document_sha_blacklist where source_user_id = p_user_id returning 1
  )
  select count(*) into v_sha_deleted from deleted;

  return jsonb_build_object(
    'ok', true,
    'phone_tombstone_cleared', v_phone_deleted,
    'sha_tombstones_cleared', v_sha_deleted,
    'updated_at', v_new_updated
  );
end;
$$;

-- =============================================================================
--  H12 (часть 1): UNIQUE на consents для ON CONFLICT DO NOTHING идемпотентности.
--  Сейчас повторный INSERT тех же (user_id, consent_type, consent_version)
--  ломал bot recordConsent → юзер залипает на consent-шаге без recovery.
-- =============================================================================
alter table consents drop constraint if exists consents_user_type_version_uniq;
alter table consents
  add constraint consents_user_type_version_uniq
  unique (user_id, consent_type, consent_version);
