-- M18 (аудит): blocked_at/blocked_reason применяются АТОМАРНО в transition_user
-- (раньше — отдельным UPDATE до перехода, что ломало оптимистичный concurrency).
-- `?`-ветка позволяет и выставлять, и очищать (NULL) поля — для ban и unban.
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
    language            = coalesce(p_patch->>'language', language),
    blocked_at          = case when p_patch ? 'blocked_at' then (p_patch->>'blocked_at')::timestamptz else blocked_at end,
    blocked_reason      = case when p_patch ? 'blocked_reason' then p_patch->>'blocked_reason' else blocked_reason end
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
