-- C-094 — таблица разрешённых переходов состояний (defense-in-depth в
-- transition_user). Enum-типы валидируют ЗНАЧЕНИЯ, но НЕ ПЕРЕХОДЫ: без этого
-- transition_user (RLS off, service-уровень, вызывается напрямую) пропускал
-- нелегитимные скачки —
--   verification_status: rejected → approved (обход модерации),
--   lifecycle_state:     blocked  → active   (воскрешение забаненного мимо unban),
--   а также любой прыжок в approved/rejected/needs_changes без потока.
-- Это вектор эскалации привилегий (напр. модератором). Добавляем позитивный
-- вайтлист переходов для двух security-критичных машин состояний.
--
-- Граф выведён из РЕАЛЬНЫХ мест использования (только пути, идущие ЧЕРЕЗ
-- transition_user). Decision/ban/unban/erase/restart — отдельные RPC с прямым
-- UPDATE users, в transition_user не заходят, поэтому их рёбра сюда НЕ входят.
-- onboarding_step-граф остаётся в TS transition() (ALLOWED_TRANSITIONS) —
-- это навигация мастера, не привилегии.

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
  v_target_lifecycle text;
  v_from text;
  v_to text;
begin
  select * into v_old from users where id = p_user_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if v_old.updated_at is distinct from p_expected_updated_at then
    return jsonb_build_object('ok', false, 'error', 'conflict');
  end if;

  -- R1-#1: ban-переходы ТОЛЬКО через admin_ban_* RPC.
  v_target_lifecycle := p_patch->>'lifecycle_state';
  if v_target_lifecycle in ('blocked','pending_ban') then
    return jsonb_build_object('ok', false, 'error', 'ban_via_dedicated_rpc',
                              'target', v_target_lifecycle);
  end if;

  -- C-094: граф допустимых переходов. Проверяем ТОЛЬКО когда ключ присутствует в
  -- патче И значение реально меняется — почти все вызовы несут лишь
  -- onboarding_step, иначе каждый анкетный шаг ложно отклонялся бы.
  if p_patch ? 'lifecycle_state' then
    v_from := v_old.lifecycle_state::text;
    v_to := p_patch->>'lifecycle_state';
    -- →blocked/pending_ban уже отклонён выше (ban_via_dedicated_rpc).
    -- blocked→{active,onboarding,paused} — легитимный РАЗБАН (unban-роут идёт
    -- через transition_user), поэтому разрешён.
    if v_to is not null and v_from is distinct from v_to
       and (v_from || '>' || v_to) not in (
         'onboarding>active',
         'active>paused',
         'paused>active',
         'blocked>active', 'blocked>onboarding', 'blocked>paused'
       ) then
      return jsonb_build_object('ok', false, 'error', 'illegal_lifecycle_transition',
                                'from', v_from, 'to', v_to);
    end if;
  end if;

  if p_patch ? 'verification_status' then
    v_from := v_old.verification_status::text;
    v_to := p_patch->>'verification_status';
    -- approved/rejected/needs_changes/not_started — только через выделенные
    -- admin_*-RPC (прямой UPDATE, минуя transition_user), поэтому их здесь нет.
    if v_to is not null and v_from is distinct from v_to
       and (v_from || '>' || v_to) not in (
         'not_started>phone_verified',
         'phone_verified>documents_uploaded',
         'documents_uploaded>pending_review',
         'needs_changes>pending_review',
         'rejected>phone_verified'
       ) then
      return jsonb_build_object('ok', false, 'error', 'illegal_verification_transition',
                                'from', v_from, 'to', v_to);
    end if;
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

do $$ begin raise notice 'C-094 transition_user graph guard (lifecycle+verification) ready.'; end $$;
