-- 20260620500000_phone_blacklist_linked_user.sql
-- F-final-2 (C10 verdict): reverse-link tombstone → source user.
--
-- Проблема: phone_blacklist rows раньше можно было сматчить только по
-- phone_hash. Если юзер сменил номер ПОСЛЕ blocking-reject (или phone_hash
-- algorithm rotation), unblock-flow терял возможность найти "его" tombstone.
-- linked_user_id даёт стабильную ссылку независимо от номера.
--
-- ON DELETE SET NULL: если юзер физически удалён (admin DELETE FROM users
-- — почти не бывает у нас, есть soft-delete), tombstone остаётся как
-- security-сигнал, но без owner-ссылки.

alter table phone_blacklist
  add column if not exists linked_user_id uuid null
  references users(id) on delete set null;

create index if not exists phone_blacklist_linked_user_idx
  on phone_blacklist(linked_user_id)
  where linked_user_id is not null;

comment on column phone_blacklist.linked_user_id is
  'Origin user. Used in /unblock-verification to clear only this user tombstones. NULL for legacy rows pre-migration 20260620500000.';

-- Обновить admin_blocking_reject — принимать linked_user_id (тот же
-- p_user_id, но явно прокидываем для ясности).
create or replace function admin_blocking_reject(
  p_user_id              uuid,
  p_admin_id             uuid,
  p_reason               text,
  p_phone_hash           text,
  p_phone_until_at       timestamptz,
  p_passport_sha256      text,
  p_selfie_sha256        text,
  p_expected_updated_at  timestamptz
) returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_user users%rowtype;
  v_new_updated timestamptz := now();
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

  -- linked_user_id заполняется — /unblock сможет найти точечно.
  if p_phone_hash is not null then
    insert into phone_blacklist(phone_hash, until_at, reason, linked_user_id)
    values (p_phone_hash, p_phone_until_at, 'verification_blocking_reject', p_user_id);
  end if;

  if p_passport_sha256 is not null then
    insert into document_sha_blacklist(sha256, kind, source_user_id, reason)
    values (p_passport_sha256, 'passport', p_user_id, 'verification_blocking_reject')
    on conflict (sha256, kind) do nothing;
  end if;
  if p_selfie_sha256 is not null then
    insert into document_sha_blacklist(sha256, kind, source_user_id, reason)
    values (p_selfie_sha256, 'selfie', p_user_id, 'verification_blocking_reject')
    on conflict (sha256, kind) do nothing;
  end if;

  return jsonb_build_object(
    'ok', true,
    'phone_tombstone_written', p_phone_hash is not null,
    'updated_at', v_new_updated
  );
end;
$$;

-- Обновить admin_unblock_verification — чистить по linked_user_id вместо
-- phone_hash+reason (надёжнее, если phone сменился).
create or replace function admin_unblock_verification(
  p_user_id              uuid,
  p_admin_id             uuid,
  p_phone_hash           text,        -- legacy fallback для rows без linked_user_id
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

  -- Чистим phone_blacklist: предпочитаем linked_user_id (надёжно), fallback
  -- на phone_hash+reason для legacy rows до миграции 500000.
  with deleted as (
    delete from phone_blacklist
     where (linked_user_id = p_user_id)
        or (linked_user_id is null
            and p_phone_hash is not null
            and phone_hash = p_phone_hash
            and reason = 'verification_blocking_reject')
    returning 1
  )
  select count(*) into v_phone_deleted from deleted;

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
