-- 20260620300000_blocking_reject_atomic.sql
-- Закрывает 7 verdict-CONFIRMED по R2/R3 (workflow adversarial-verify):
--   C1/C2 (CRITICAL): blocking-reject теперь атомарный RPC. Раньше: транзишн
--                     + user_documents UPDATE + phone_blacklist INSERT шли
--                     отдельными запросами; lambda crash / DB timeout между
--                     ними оставлял tombstone отсутствующим → bypass R2.
--   C3 (HIGH):        sha NULL guard переезжает в app-layer (БД-CHECK
--                     ломает 6 legacy approved-rows, backfill отдельно).
--                     Здесь — только enforcement constraint'ы.
--   C4 (HIGH):        partial UNIQUE indexes на (sha256, status='approved')
--                     и (sha256, status='rejected' AND category='blocking')
--                     — закрывает TOCTOU race двух модераторов approve.
--   C5 (HIGH):        document_sha_blacklist append-only — sha-защита
--                     устойчива к erase_user/retry, которые сносят
--                     user_documents.
--   C8 (CRIT):        phone_tombstone_skipped audit действует с app-layer'а.
--                     RPC принимает NULL phone_hash и тихо пропускает
--                     INSERT, route ловит этот случай и аудитит.

-- =============================================================================
-- 1. document_sha_blacklist — append-only sha tombstone (C5)
-- =============================================================================
create table if not exists document_sha_blacklist (
  id              uuid primary key default gen_random_uuid(),
  sha256          text not null,
  kind            text not null check (kind in ('passport','selfie')),
  blocked_at      timestamptz not null default now(),
  source_user_id  uuid null references users(id) on delete set null,
  reason          text not null,
  unique (sha256, kind)
);

create index if not exists document_sha_blacklist_sha_kind_idx
  on document_sha_blacklist(sha256, kind);

comment on table document_sha_blacklist is
  'Tombstone hash паспорта/селфи после blocking-reject. Append-only — survives erase_user (source_user_id ON DELETE SET NULL) и retry (категория сбрасывается, но эта таблица отдельная).';

-- =============================================================================
-- 2. Partial UNIQUE indexes на user_documents.sha256 (C4)
--    Закрывает race "два модератора одновременно approve дублей".
--    UPDATE с дублирующим sha упадёт на 23505 — route ловит и возвращает 409.
-- =============================================================================
drop index if exists user_documents_passport_sha256_approved_idx;
drop index if exists user_documents_selfie_sha256_approved_idx;

create unique index if not exists user_documents_passport_sha256_uniq_approved
  on user_documents(passport_sha256)
  where passport_sha256 is not null and status = 'approved';

create unique index if not exists user_documents_selfie_sha256_uniq_approved
  on user_documents(selfie_sha256)
  where selfie_sha256 is not null and status = 'approved';

create unique index if not exists user_documents_passport_sha256_uniq_blocking
  on user_documents(passport_sha256)
  where passport_sha256 is not null and status = 'rejected' and reject_category = 'blocking';

create unique index if not exists user_documents_selfie_sha256_uniq_blocking
  on user_documents(selfie_sha256)
  where selfie_sha256 is not null and status = 'rejected' and reject_category = 'blocking';

-- =============================================================================
-- 3. admin_blocking_reject RPC — атомарный (C1/C2)
--    Один транзакционный блок: transition users + user_state_transitions +
--    user_documents UPDATE + phone_blacklist INSERT + document_sha_blacklist
--    INSERT. ЛЮБОЙ exception → ROLLBACK ВСЕГО. Никаких частично применённых
--    blocking-reject'ов больше.
--
--    phone_hash nullable: если у юзера нет phone (legacy/erase-restored),
--    route фиксирует phone_tombstone_skipped в audit (C8).
-- =============================================================================
create or replace function admin_blocking_reject(
  p_user_id              uuid,
  p_admin_id             uuid,
  p_reason               text,
  p_phone_hash           text,        -- nullable
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

  -- 3a. Users → rejected
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

  -- 3b. user_documents → rejected/blocking
  update user_documents set
    status            = 'rejected',
    reject_category   = 'blocking',
    reject_reason     = p_reason,
    reject_target     = null,
    moderated_by      = p_admin_id::text,
    moderated_at      = v_new_updated
  where user_id = p_user_id;

  -- 3c. phone_blacklist (только если phone есть)
  if p_phone_hash is not null then
    insert into phone_blacklist(phone_hash, until_at, reason)
    values (p_phone_hash, p_phone_until_at, 'verification_blocking_reject');
  end if;

  -- 3d. document_sha_blacklist (append-only; SHA защита, переживает retry/delete)
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
