-- ADMIN-2 — admin_claim_verification не откатывает прогресс при повторном claim.
--
-- Раньше UPDATE ставил state='assigned' безусловно. Когда тот же модератор
-- повторно POST'ил /claim по кейсу, уже дошедшему до data_entry/ready_to_decide
-- (сохранил драфт / дошёл до решения), state откатывался в assigned — обратный
-- переход, запрещённый стейт-машиной (case-state-machine.ts). Фикс: назначаем
-- 'assigned' только при свежем claim (state='new'); иначе оставляем текущий.

create or replace function admin_claim_verification(
  p_case_id uuid,
  p_admin_id uuid
) returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_state verification_case_state;
  v_assignee uuid;
begin
  select state, assignee_id into v_state, v_assignee
    from verification_cases where id = p_case_id for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'case_not_found');
  end if;

  if v_state = 'closed' then
    return jsonb_build_object('ok', false, 'error', 'case_closed');
  end if;

  if v_assignee is not null and v_assignee <> p_admin_id then
    return jsonb_build_object('ok', false, 'error', 'case_already_claimed',
                              'assignee_id', v_assignee);
  end if;

  update verification_cases
    set state = case when v_state = 'new' then 'assigned'::verification_case_state
                     else v_state end,          -- ADMIN-2: не откатываем прогресс
        assignee_id = p_admin_id,
        claimed_at = coalesce(claimed_at, now())
    where id = p_case_id;

  perform _emit_case_event(p_case_id, p_admin_id, 'claimed', '{}'::jsonb);

  return jsonb_build_object(
    'ok', true,
    'state', case when v_state = 'new' then 'assigned' else v_state::text end
  );
end$$;
