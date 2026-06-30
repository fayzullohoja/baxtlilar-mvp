-- 20260630020000_admin_blocking_reject_constraint_fix.sql
-- Bug #17 (E2E loop pass 3): admin_blocking_reject (определена в миграции
-- 20260620800000_final_adversarial_fixes.sql) использует `on conflict
-- (sha256, kind) do nothing` для inserts в document_sha_blacklist. Но
-- миграция 20260620920000_split_window_and_jti_fixes.sql ДРОПНУЛА этот
-- constraint и заменила его на `(sha256, kind, source_user_id, reason)`.
--
-- Поэтому admin_blocking_reject падал на runtime с PostgreSQL error 42P10
-- "constraint sha256_kind does not exist" → транзакция rollback → юзер
-- оставался в verification_status='pending_review'. Полностью ломало
-- blocking-reject flow.
--
-- Пересоздаём RPC с правильным conflict target.

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

  v_session_secret := current_setting('app.session_secret', true);
  if v_session_secret is null or length(v_session_secret) = 0 then
    return jsonb_build_object('ok', false, 'error', 'session_secret_not_configured');
  end if;

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

  -- Bug #17: используем актуальный constraint после миграции 920000.
  if v_doc.passport_sha256 is not null then
    insert into document_sha_blacklist(sha256, kind, source_user_id, reason)
    values (v_doc.passport_sha256, 'passport', p_user_id, 'verification_blocking_reject')
    on conflict (sha256, kind, source_user_id, reason) do nothing;
  end if;
  if v_doc.selfie_sha256 is not null then
    insert into document_sha_blacklist(sha256, kind, source_user_id, reason)
    values (v_doc.selfie_sha256, 'selfie', p_user_id, 'verification_blocking_reject')
    on conflict (sha256, kind, source_user_id, reason) do nothing;
  end if;

  return jsonb_build_object(
    'ok', true,
    'phone_tombstone_written', v_phone_hash is not null,
    'updated_at', v_new_updated
  );
end;
$$;

do $$ begin raise notice 'admin_blocking_reject constraint mismatch fixed.'; end $$;
