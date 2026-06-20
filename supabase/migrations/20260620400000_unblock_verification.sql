-- 20260620400000_unblock_verification.sql
-- F-final-1 (C9 verdict): super-admin может вернуть blocking-rejected юзера
-- обратно в очередь модерации после misclick / пересмотра. Атомарный RPC,
-- который чистит И сам user_documents.reject_category, И обе tombstone-таблицы
-- (phone_blacklist по hash, document_sha_blacklist по source_user_id).

create or replace function admin_unblock_verification(
  p_user_id              uuid,
  p_admin_id             uuid,
  p_phone_hash           text,        -- nullable: NULL если у юзера phone уже NULL
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

  -- Жёсткие предикаты: только blocking-rejected, не путать с обычным reject/blocked-ban.
  if v_user.verification_status <> 'rejected' then
    return jsonb_build_object('ok', false, 'error', 'not_rejected',
                              'current', v_user.verification_status);
  end if;
  if v_user.lifecycle_state <> 'onboarding' then
    -- blocked / pending_ban — это про общий ban, не verification-flow.
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

  -- 1. Users: verification_status → pending_review, step → moderation_pending.
  --    Заявка снова в админ-очереди, документы из user_documents остаются прежними.
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

  -- 2. user_documents: reject_category → null, status → pending_review.
  update user_documents set
    status            = 'pending_review',
    reject_category   = null,
    reject_reason     = null,
    reject_target     = null,
    moderated_by      = null,
    moderated_at      = null
  where user_id = p_user_id;

  -- 3. phone_blacklist: убираем tombstone (только rows этого blocking-reject'а).
  if p_phone_hash is not null then
    with deleted as (
      delete from phone_blacklist
       where phone_hash = p_phone_hash
         and reason = 'verification_blocking_reject'
      returning 1
    )
    select count(*) into v_phone_deleted from deleted;
  end if;

  -- 4. document_sha_blacklist: убираем tombstone по source_user_id.
  --    Если другой юзер потом получил blocking с тем же sha — его строка
  --    останется (другой source_user_id). Это правильно.
  with deleted as (
    delete from document_sha_blacklist
     where source_user_id = p_user_id
    returning 1
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
