-- 20260620920000_split_window_and_jti_fixes.sql
-- Финал adversarial sweep по C1+H8 + H3 (verdict REFUTED после первого fix-batch).
--
-- C1+H8 split-window:
--   1) UNIQUE (sha256, kind) → multi-user collision: если A (self_delete) и B
--      (verification_blocking_reject) имеют один passport sha, А's tombstone
--      молча игнорировался ON CONFLICT DO NOTHING. После unblock B
--      A's footprint исчезал → catfish C проходил checkDup.
--      Fix: UNIQUE (sha256, kind, source_user_id, reason). Multiple tombstones
--      на один sha разрешены; checkDup всё ещё O(1) по (sha,kind) LIMIT 1.
--   2) admin_unblock_verification удаляет sha_blacklist WHERE source_user_id=$user
--      БЕЗ фильтра по reason — мог снести self_delete tombstone того же user
--      (если A до blocking-reject уже self_delete'нулся). Fix: filter по
--      reason='verification_blocking_reject'.
--
-- H3 single-use jti:
--   Token из бота bound на telegram_id, но без single-use guard. Кража
--   start_param + initData → replay в течение 10-минутного TTL.
--   Fix: новая таблица start_token_uses (jti PK + used_at) + bootstrap
--   INSERT'ит row, conflict = replay → 401.

-- =============================================================================
-- C1+H8: PK расширяется до (sha256, kind, source_user_id, reason)
-- =============================================================================
alter table document_sha_blacklist
  drop constraint if exists document_sha_blacklist_sha256_kind_key;

alter table document_sha_blacklist
  add constraint document_sha_blacklist_sha_kind_user_reason_uniq
  unique (sha256, kind, source_user_id, reason);

-- =============================================================================
-- C1+H8: erase_user — заменить ON CONFLICT (sha,kind) DO NOTHING на новый PK
-- =============================================================================
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

-- =============================================================================
-- C1+H8: admin_unblock_verification — фильтр sha_blacklist по reason
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

  with deleted as (
    delete from phone_blacklist
     where linked_user_id = p_user_id
       and reason = 'verification_blocking_reject'
     returning 1
  )
  select count(*) into v_phone_deleted from deleted;

  with deleted as (
    delete from document_sha_blacklist
     where source_user_id = p_user_id
       and reason = 'verification_blocking_reject'
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

-- =============================================================================
-- H3: single-use jti для start_token
-- =============================================================================
create table if not exists start_token_uses (
  jti          text        primary key,
  user_id      uuid        not null references users(id) on delete cascade,
  telegram_id  bigint      not null,
  used_at      timestamptz not null default now()
);

create index if not exists start_token_uses_used_at_idx
  on start_token_uses (used_at);

create or replace function claim_start_token(
  p_jti          text,
  p_user_id      uuid,
  p_telegram_id  bigint
) returns boolean
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  insert into start_token_uses(jti, user_id, telegram_id)
  values (p_jti, p_user_id, p_telegram_id)
  on conflict (jti) do nothing;

  return found;
end;
$$;

-- Periodic cleanup: rows старше 1 часа гарантированно за пределами TTL=600s.
-- Запускать вручную или из cron.
create or replace function gc_start_token_uses()
returns integer
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_n integer;
begin
  with d as (
    delete from start_token_uses where used_at < now() - interval '1 hour' returning 1
  )
  select count(*) into v_n from d;
  return v_n;
end;
$$;

-- =============================================================================
-- H11 polish: claim_export_window — добавить set search_path (skeptic flagged)
-- =============================================================================
create or replace function claim_export_window(
  p_user_id uuid,
  p_cooldown_seconds integer
) returns boolean
language plpgsql
security definer
set search_path = public, pg_catalog, pg_temp
as $$
declare
  v_now timestamptz := now();
  v_cutoff timestamptz := v_now - make_interval(secs => p_cooldown_seconds);
  v_id uuid;
begin
  update users
     set exported_at = v_now
   where id = p_user_id
     and (exported_at is null or exported_at < v_cutoff)
   returning id into v_id;
  return v_id is not null;
end;
$$;

revoke all on function claim_export_window(uuid, integer) from public;
