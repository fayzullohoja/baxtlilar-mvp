-- Фаза 1 / Группа A — фиксы по ревью:
--  * истёкшие-но-'pending' ряды чистим под локом → нет unique_violation 23505 (2 блокера)
--  * блок-проверка ВНУТРИ транзакции (TOCTOU: нельзя открыть чат после блока)
--  * отказ блокирует повтор не навсегда, а на 30 дней
--  * если чат уже есть — сразу возвращаем его
--  * advisory-лок в двухключевой форме (без склейки строк)
create or replace function process_interest(
  p_sender uuid,
  p_receiver uuid,
  p_message text,
  p_hours int,
  p_limit int
)
returns table (result text, chat_id uuid)
language plpgsql
as $$
declare
  v_a uuid := least(p_sender, p_receiver);
  v_b uuid := greatest(p_sender, p_receiver);
  v_rev uuid;
  v_chat uuid;
begin
  perform pg_advisory_xact_lock(hashtext(v_a::text), hashtext(v_b::text));

  -- 1) гасим истёкшие pending обеих сторон пары (снимаем конфликт с partial-unique индексом)
  update match_requests set status = 'expired'
   where status = 'pending' and auto_decline_at <= now()
     and ((sender_id = p_sender and receiver_id = p_receiver)
       or (sender_id = p_receiver and receiver_id = p_sender));

  -- 2) блокировка в любую сторону — атомарно под локом
  if exists (select 1 from blocks
               where (blocker_id = p_sender and blocked_id = p_receiver)
                  or (blocker_id = p_receiver and blocked_id = p_sender)) then
    return query select 'blocked'::text, null::uuid;
    return;
  end if;

  -- 3) чат уже существует → просто ведём в него
  select id into v_chat from chats where user_a = v_a and user_b = v_b;
  if v_chat is not null then
    return query select 'mutual'::text, v_chat;
    return;
  end if;

  -- 4) встречный живой pending → взаимный интерес: принять + открыть чат
  select id into v_rev from match_requests
    where sender_id = p_receiver and receiver_id = p_sender
      and status = 'pending' and auto_decline_at > now()
    for update;
  if found then
    update match_requests set status = 'accepted' where id = v_rev;
    insert into chats(user_a, user_b) values (v_a, v_b)
      on conflict (user_a, user_b) do nothing returning id into v_chat;
    if v_chat is null then select id into v_chat from chats where user_a = v_a and user_b = v_b; end if;
    return query select 'mutual'::text, v_chat;
    return;
  end if;

  -- 5) получатель отказал отправителю за последние 30 дней → не даём слать снова (анти-харассмент)
  if exists (select 1 from match_requests
               where sender_id = p_sender and receiver_id = p_receiver
                 and status = 'declined' and created_at > now() - interval '30 days') then
    return query select 'declined_block'::text, null::uuid;
    return;
  end if;

  -- 6) уже есть активная заявка отправитель→получатель (живой pending или принятая)
  if exists (select 1 from match_requests
               where sender_id = p_sender and receiver_id = p_receiver
                 and (status = 'accepted' or (status = 'pending' and auto_decline_at > now()))) then
    return query select 'already_sent'::text, null::uuid;
    return;
  end if;

  -- 7) дневная квота
  if not bump_quota(p_sender, 'interests', p_limit) then
    return query select 'daily_limit'::text, null::uuid;
    return;
  end if;

  insert into match_requests(sender_id, receiver_id, message, auto_decline_at)
    values (p_sender, p_receiver, p_message, now() + make_interval(hours => p_hours));
  return query select 'sent'::text, null::uuid;
end $$;
