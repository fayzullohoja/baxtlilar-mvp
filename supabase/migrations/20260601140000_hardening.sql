-- Hardening (аудит S1-S3): атомарность transition, приватность, неизменяемость журналов

-- ── SM-1: атомарная смена статуса + аудит в одной транзакции ──────────────
-- TS делает guard (ALLOWED_TRANSITIONS) и передаёт expected_updated_at для
-- optimistic concurrency. Функция = одна транзакция: UPDATE users + INSERT аудита.
create or replace function transition_user(
  p_user_id uuid,
  p_patch jsonb,
  p_expected_updated_at timestamptz,
  p_reason text,
  p_by_kind triggered_by_kind,
  p_by_id text
) returns jsonb
language plpgsql
as $$
declare
  v_old users%rowtype;
  v_key text;
  v_old_val text;
  v_new_val text;
begin
  select * into v_old from users where id = p_user_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if v_old.updated_at is distinct from p_expected_updated_at then
    return jsonb_build_object('ok', false, 'error', 'conflict');
  end if;

  update users set
    lifecycle_state     = coalesce((p_patch->>'lifecycle_state')::lifecycle_state, lifecycle_state),
    onboarding_step     = coalesce((p_patch->>'onboarding_step')::onboarding_step, onboarding_step),
    verification_status = coalesce((p_patch->>'verification_status')::verification_status, verification_status),
    profile_completion  = coalesce((p_patch->>'profile_completion')::profile_completion, profile_completion),
    quiz_completion     = coalesce((p_patch->>'quiz_completion')::quiz_completion, quiz_completion),
    phone_verified      = coalesce((p_patch->>'phone_verified')::boolean, phone_verified),
    phone_number        = coalesce(p_patch->>'phone_number', phone_number),
    language            = coalesce(p_patch->>'language', language)
  where id = p_user_id;

  for v_key in select jsonb_object_keys(p_patch) loop
    v_old_val := to_jsonb(v_old) ->> v_key;
    v_new_val := p_patch ->> v_key;
    if v_old_val is distinct from v_new_val then
      insert into user_state_transitions(
        user_id, field, from_value, to_value, reason, triggered_by_kind, triggered_by_id
      ) values (p_user_id, v_key, v_old_val, v_new_val, p_reason, p_by_kind, p_by_id);
    end if;
  end loop;

  return jsonb_build_object('ok', true);
end;
$$;

-- ── BUG-2/ONB-5: согласия идемпотентны ───────────────────────────────────
alter table consents
  add constraint consents_uniq unique (user_id, consent_type, consent_version);

-- ── SEC-3: приватность бакета документов закреплена в источнике истины ────
update storage.buckets set public = false where id in ('user-documents');
-- storage.objects имеет RLS включённым по умолчанию и без policy для anon/authenticated,
-- поэтому доступ возможен только через service_role (сервер) и signed URL. Фиксируем явно.

-- ── ADM-3: журналы защищены от ИЗМЕНЕНИЯ (UPDATE) даже под service_role ───
-- DELETE намеренно разрешён: каскад при удалении пользователя + право на удаление
-- персональных данных (Чат 8 legal). Содержимое истории нельзя подделать, но можно стереть
-- в рамках erasure. (Изначально блокировали и DELETE — это ломало каскад users→logs.)
create or replace function prevent_log_mutation() returns trigger
language plpgsql as $$
begin
  raise exception 'append-only log: % not allowed on %', tg_op, tg_table_name;
end;
$$;

create trigger user_state_transitions_no_update
  before update on user_state_transitions
  for each row execute function prevent_log_mutation();

create trigger admin_audit_log_no_update
  before update on admin_audit_log
  for each row execute function prevent_log_mutation();
