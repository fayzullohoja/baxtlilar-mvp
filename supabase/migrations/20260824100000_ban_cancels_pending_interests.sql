-- Находка аудита: подтверждённый бан не гасил уже отправленные интересы.
--
-- Забаненного убирали из подбора, но заявка, которую он успел отправить,
-- продолжала висеть во «Входящих» у получателя. Проверено по коду: список
-- входящих фильтрует только получателя, статус и срок (нет фильтра по
-- состоянию отправителя), а getMiniProfiles грузит имя, возраст, город и
-- одобренное фото без проверки lifecycle_state. То есть получатель видел
-- карточку забаненного с его сопроводительным сообщением и мог нажать
-- «Принять»; чат при этом создавался и открывался заглушкой.
--
-- Ровно эту работу уже делает blockUser в приложении при жалобе - там pending
-- в обе стороны переводятся в declined/withdrawn. Бан её не делал.
--
-- Гасим ИМЕННО в confirm, а не в propose: pending_ban это предложение, которое
-- второй админ может отклонить, и рвать людям заявки до подтверждения нельзя.
create or replace function public.admin_ban_confirm(
  p_user_id uuid,
  p_admin_id uuid,
  p_ttl_seconds integer,
  p_blocked_reason_override text,
  p_expected_updated_at timestamp with time zone
)
returns jsonb
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_row users%rowtype;
  v_new_updated timestamptz := now();
  v_final_reason text;
  v_cancelled_in int;
  v_cancelled_out int;
begin
  -- R1-#2: fail-closed на NULL admin_id (вдруг будущий callsite забыл).
  if p_admin_id is null then
    return jsonb_build_object('ok', false, 'error', 'admin_id_required');
  end if;

  select * into v_row from users where id = p_user_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if v_row.updated_at <> p_expected_updated_at then
    return jsonb_build_object('ok', false, 'error', 'conflict');
  end if;
  if v_row.pending_ban_at is null or v_row.pending_ban_by_admin_id is null then
    return jsonb_build_object('ok', false, 'error', 'no_pending_proposal');
  end if;
  -- R1-#5: явная проверка lifecycle_state. constraint+propose должны это
  -- гарантировать, но дешёвый belt против будущих регрессий.
  if v_row.lifecycle_state <> 'pending_ban' then
    return jsonb_build_object('ok', false, 'error', 'inconsistent_state',
                              'state', v_row.lifecycle_state);
  end if;
  if v_row.pending_ban_at < (now() - make_interval(secs => p_ttl_seconds)) then
    return jsonb_build_object('ok', false, 'error', 'expired',
                              'pending_at', v_row.pending_ban_at);
  end if;
  if v_row.pending_ban_by_admin_id = p_admin_id then
    return jsonb_build_object('ok', false, 'error', 'same_admin');
  end if;

  v_final_reason := coalesce(
    nullif(btrim(p_blocked_reason_override), ''), v_row.pending_ban_reason
  );

  update users set
    lifecycle_state         = 'blocked',
    blocked_at              = v_new_updated,
    blocked_reason          = v_final_reason,
    pending_ban_at          = null,
    pending_ban_by_admin_id = null,
    pending_ban_reason      = null,
    updated_at              = v_new_updated
  where id = p_user_id;

  -- Гасим висящие интересы в обе стороны, той же семантикой, что blockUser:
  -- входящие забаненному - withdrawn (отправитель как бы отозвал, получатель
  -- забанен и всё равно ничего не решит), исходящие от забаненного - declined
  -- (для получателя это отказ, а не молча пропавшая карточка).
  update match_requests
     set status = 'withdrawn', updated_at = v_new_updated
   where receiver_id = p_user_id and status = 'pending';
  get diagnostics v_cancelled_in = row_count;

  update match_requests
     set status = 'declined', updated_at = v_new_updated
   where sender_id = p_user_id and status = 'pending';
  get diagnostics v_cancelled_out = row_count;

  insert into user_state_transitions
    (user_id, field, from_value, to_value, reason, triggered_by_kind, triggered_by_id)
  values
    (p_user_id, 'lifecycle_state', 'pending_ban', 'blocked',
     'ban_confirmed: ' || v_final_reason, 'admin', p_admin_id::text);

  return jsonb_build_object(
    'ok', true,
    'proposer_admin_id', v_row.pending_ban_by_admin_id,
    'proposer_reason',   v_row.pending_ban_reason,
    'final_reason',      v_final_reason,
    'cancelled_incoming', v_cancelled_in,
    'cancelled_outgoing', v_cancelled_out,
    'updated_at',        v_new_updated
  );
end;
$function$;
