-- DZ-3 admin_restart_onboarding + DZ-2 admin_hard_delete_user (операторские
-- действия, вызываются из /api/admin/users/[id]/{restart-onboarding,delete},
-- superadmin-gated в роутах).

-- ── DZ-3: restart-onboarding (WIPE consents, решение учредителя) ──────────────
-- Стирает анкету/фото/паспорт/квиз/СОГЛАСИЯ, сбрасывает юзера на старт онбординга
-- (bot_language), сохраняя telegram_id/phone. Кейсы верификации ЗАКРЫВАЕТ (не
-- удаляет — чтобы не трогать append-only case_events). Guard: не рестартим
-- blocked/pending_ban (чтобы не отмывать бан).
create or replace function admin_restart_onboarding(
  p_user_id uuid,
  p_admin_id uuid,
  p_reason text default null
) returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare v_state text; v_pending timestamptz;
begin
  select lifecycle_state, pending_ban_at into v_state, v_pending
    from users where id = p_user_id for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if v_state = 'blocked' or v_pending is not null then
    return jsonb_build_object('ok', false, 'error', 'blocked_or_pending_ban');
  end if;

  delete from profile_photos where user_id = p_user_id;
  delete from quiz_answers where user_id = p_user_id;
  delete from quiz_results where user_id = p_user_id;
  delete from user_documents where user_id = p_user_id;
  delete from consents where user_id = p_user_id;                 -- WIPE consents
  delete from daily_request_quotas where user_id = p_user_id;
  update user_identity set superseded_at = now()
    where user_id = p_user_id and superseded_at is null;
  update verification_cases
     set state = 'closed', outcome = 'restarted', decided_by = p_admin_id, decided_at = now()
   where user_id = p_user_id and state <> 'closed';
  delete from user_profiles where user_id = p_user_id;

  update users set
    lifecycle_state     = 'onboarding',
    onboarding_step     = 'bot_language',
    verification_status = 'not_started',
    profile_completion  = 'not_started',
    quiz_completion     = 'not_started',
    sanction_level      = 'none',
    paused_at = null, blocked_at = null, blocked_reason = null,
    avatar_path = null,
    updated_at = now()
  where id = p_user_id;

  insert into admin_audit_log(admin_id, action, entity, entity_id, reason, new_value)
  values (p_admin_id, 'restart_onboarding', 'user', p_user_id::text, p_reason,
          jsonb_build_object('wiped_consents', true, 'prev_state', v_state));
  insert into user_state_transitions(user_id, field, from_value, to_value, reason, triggered_by_kind, triggered_by_id)
  values (p_user_id, 'lifecycle_state', v_state, 'onboarding',
          coalesce(p_reason, 'restart onboarding'), 'admin', p_admin_id::text);

  return jsonb_build_object('ok', true);
end;
$$;

-- ── DZ-2: hard-delete (полное удаление, необратимо) ──────────────────────────
-- Собирает storage-пути ДО удаления (route чистит файлы), пишет аудит ДО
-- исчезновения строки, затем DELETE FROM users (FK cascade сносит всех детей).
-- case_events имеет append-only BEFORE DELETE триггер — на каскаде он бросит
-- exception, поэтому на время удаления отключаем его (нужны права владельца →
-- security definer). НЕ пишем *_blacklist tombstones (это операторская чистка
-- мусора, а не self-delete).
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
