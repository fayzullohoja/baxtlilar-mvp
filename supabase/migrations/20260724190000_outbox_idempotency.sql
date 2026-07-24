-- C-032 — идемпотентность и надёжность tg_outbox.
--
-- Проблемы:
--  1. dual-write: interest/chat enqueue'ят событие ОТДЕЛЬНОЙ транзакцией после
--     коммита бизнес-RPC → краш/сбой очереди теряет chat/match-событие.
--  2. нет claim/lock: cron-drain и sync tryDeliverNow берут одну строку без
--     блокировки → двойная доставка.
--  3. нет дедупа: повторный enqueue создаёт дубль.
--  4. нет backoff: упавшая строка ретраится каждый тик крона до attempts=5.
--
-- Решение: enqueue внутрь бизнес-RPC (одна транзакция) + dedup_key (уникальный
-- на СОБЫТИЕ) + claim FOR UPDATE SKIP LOCKED с locked_until + next_attempt_at
-- (backoff). decision-путь уже атомарен (accept_interest, C-026).

-- ── схема ──────────────────────────────────────────────────────────────────
alter table tg_outbox add column if not exists locked_until    timestamptz;
alter table tg_outbox add column if not exists next_attempt_at timestamptz not null default now();
alter table tg_outbox add column if not exists dedup_key       text;

-- Non-partial unique: NULL'ы различны по умолчанию (верификационные 3-арг вызовы
-- шлют dedup_key=NULL → никогда не конфликтуют). Так `on conflict (dedup_key)`
-- работает без предиката. dedup_key несёт УНИКАЛЬНЫЙ id события (request/chat/
-- message), а не канал — иначе повтор burst'а навсегда заглушил бы уведомления.
create unique index if not exists tg_outbox_dedup_key on tg_outbox (dedup_key);

-- claim видит только «готовые к доставке»: не заблокированные и не отложенные.
create index if not exists tg_outbox_claimable_idx
  on tg_outbox (next_attempt_at)
  where sent_at is null;

-- ── enqueue с дедупом ────────────────────────────────────────────────────────
-- Дропаем старую 3-арг сигнатуру: иначе 4-арг-с-default создаст ОВЕРЛОАД, и
-- 3-арг вызов станет неоднозначным (function is not unique).
drop function if exists enqueue_tg_outbox(uuid, text, jsonb);

create or replace function enqueue_tg_outbox(
  p_user_id uuid,
  p_event_type text,
  p_payload jsonb default '{}'::jsonb,
  p_dedup_key text default null
) returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare v_id uuid;
begin
  insert into tg_outbox(user_id, event_type, payload, dedup_key)
  values (p_user_id, p_event_type, p_payload, p_dedup_key)
  on conflict (dedup_key) do nothing
  returning id into v_id;
  return v_id; -- NULL если дедуплицировано (повторный enqueue того же события)
end;
$$;

-- ── claim: пачка (cron) ─────────────────────────────────────────────────────
create or replace function claim_tg_outbox(p_limit int, p_lock_seconds int)
returns setof tg_outbox
language plpgsql
as $$
begin
  return query
  with c as (
    select id from tg_outbox
     where sent_at is null
       and attempts < 5
       and next_attempt_at <= now()
       and (locked_until is null or locked_until <= now())
     order by created_at
     limit p_limit
     for update skip locked
  )
  update tg_outbox o
     set locked_until = now() + make_interval(secs => p_lock_seconds)
    from c
   where o.id = c.id
  returning o.*;
end$$;

-- ── claim: одна строка (sync tryDeliverNow) ─────────────────────────────────
create or replace function claim_tg_outbox_one(p_id uuid, p_lock_seconds int)
returns setof tg_outbox
language plpgsql
as $$
begin
  return query
  with c as (
    select id from tg_outbox
     where id = p_id
       and sent_at is null
       and attempts < 5
       and (locked_until is null or locked_until <= now())
     for update skip locked
  )
  update tg_outbox o
     set locked_until = now() + make_interval(secs => p_lock_seconds)
    from c
   where o.id = c.id
  returning o.*;
end$$;

-- ── process_interest: enqueue ВНУТРИ (устранить dual-write) ──────────────────
-- Идентично 20260602170000, но: (а) возвращает outbox_id, (б) на mutual/sent
-- enqueue'ит уведомление p_receiver в ТОЙ ЖЕ транзакции с dedup по id события.
-- Порядок локов не тронут: advisory (стр.1) до FOR UPDATE (встречный pending).
-- Меняем тип возврата (+outbox_id) → create or replace нельзя, дропаем сначала.
drop function if exists process_interest(uuid, uuid, text, int, int);
create or replace function process_interest(
  p_sender uuid,
  p_receiver uuid,
  p_message text,
  p_hours int,
  p_limit int
)
returns table (result text, chat_id uuid, outbox_id uuid)
language plpgsql
as $$
declare
  v_a uuid := least(p_sender, p_receiver);
  v_b uuid := greatest(p_sender, p_receiver);
  v_rev uuid;
  v_chat uuid;
  v_req uuid;
  v_outbox uuid;
begin
  perform pg_advisory_xact_lock(hashtext(v_a::text), hashtext(v_b::text));

  update match_requests set status = 'expired'
   where status = 'pending' and auto_decline_at <= now()
     and ((sender_id = p_sender and receiver_id = p_receiver)
       or (sender_id = p_receiver and receiver_id = p_sender));

  if exists (select 1 from blocks
               where (blocker_id = p_sender and blocked_id = p_receiver)
                  or (blocker_id = p_receiver and blocked_id = p_sender)) then
    return query select 'blocked'::text, null::uuid, null::uuid;
    return;
  end if;

  -- чат уже существует → mutual; уведомление дедупится по chat_id (не спамим повтором)
  select id into v_chat from chats where user_a = v_a and user_b = v_b;
  if v_chat is not null then
    v_outbox := enqueue_tg_outbox(p_receiver, 'mutual_match', '{}'::jsonb, 'mutual_match:' || v_chat::text);
    return query select 'mutual'::text, v_chat, v_outbox;
    return;
  end if;

  -- встречный живой pending → взаимный интерес: принять + открыть чат + уведомить
  select id into v_rev from match_requests
    where sender_id = p_receiver and receiver_id = p_sender
      and status = 'pending' and auto_decline_at > now()
    for update;
  if found then
    update match_requests set status = 'accepted' where id = v_rev;
    insert into chats(user_a, user_b) values (v_a, v_b)
      on conflict (user_a, user_b) do nothing returning id into v_chat;
    if v_chat is null then select id into v_chat from chats where user_a = v_a and user_b = v_b; end if;
    v_outbox := enqueue_tg_outbox(p_receiver, 'mutual_match', '{}'::jsonb, 'mutual_match:' || v_chat::text);
    return query select 'mutual'::text, v_chat, v_outbox;
    return;
  end if;

  if exists (select 1 from match_requests
               where sender_id = p_sender and receiver_id = p_receiver
                 and status = 'declined' and created_at > now() - interval '30 days') then
    return query select 'declined_block'::text, null::uuid, null::uuid;
    return;
  end if;

  if exists (select 1 from match_requests
               where sender_id = p_sender and receiver_id = p_receiver
                 and (status = 'accepted' or (status = 'pending' and auto_decline_at > now()))) then
    return query select 'already_sent'::text, null::uuid, null::uuid;
    return;
  end if;

  if not bump_quota(p_sender, 'interests', p_limit) then
    return query select 'daily_limit'::text, null::uuid, null::uuid;
    return;
  end if;

  -- новая заявка + уведомление о новом интересе в ТОЙ ЖЕ транзакции (dedup по req id)
  insert into match_requests(sender_id, receiver_id, message, auto_decline_at)
    values (p_sender, p_receiver, p_message, now() + make_interval(hours => p_hours))
    returning id into v_req;
  v_outbox := enqueue_tg_outbox(p_receiver, 'new_interest', '{}'::jsonb, 'new_interest:' || v_req::text);
  return query select 'sent'::text, null::uuid, v_outbox;
end$$;

-- ── send_chat_message: вставка сообщения + enqueue в ОДНОЙ транзакции ────────
-- «queue outage не теряет chat event»: сообщение и уведомление коммитятся вместе.
-- Дебаунс (пуш только на первое непрочитанное от отправителя) считается ЗДЕСЬ,
-- атомарно с вставкой. Получатель выводится из чата (не доверяем аргументу).
-- Rate-limit/контакт-фильтр/блок остаются пред-проверками в роуте.
create or replace function send_chat_message(p_chat uuid, p_sender uuid, p_body text)
returns table (message_id uuid, created_at timestamptz, should_push boolean, outbox_id uuid)
language plpgsql
as $$
declare
  v_other uuid;
  v_unread int;
  v_should_push boolean;
  v_msg uuid;
  v_created timestamptz;
  v_outbox uuid;
begin
  -- получатель = второй участник; заодно проверяем членство отправителя
  select case when user_a = p_sender then user_b else user_a end
    into v_other
    from chats
   where id = p_chat and (user_a = p_sender or user_b = p_sender);
  if not found then
    return; -- нет чата / отправитель не участник → пусто (роут → 404/500)
  end if;

  -- дебаунс: пушим только если у отправителя ещё НЕТ непрочитанных в этом чате
  select count(*) into v_unread from chat_messages
   where chat_id = p_chat and sender_id = p_sender and read_at is null;
  v_should_push := (v_unread = 0);

  insert into chat_messages(chat_id, sender_id, body)
  values (p_chat, p_sender, p_body)
  returning id, chat_messages.created_at into v_msg, v_created;

  update chats set
    last_message_at = now(),
    typing_a_until = case when user_a = p_sender then null else typing_a_until end,
    typing_b_until = case when user_b = p_sender then null else typing_b_until end
   where id = p_chat;

  if v_should_push then
    v_outbox := enqueue_tg_outbox(v_other, 'new_message', '{}'::jsonb, 'new_message:' || v_msg::text);
  end if;

  return query select v_msg, v_created, v_should_push, v_outbox;
end$$;

do $$ begin raise notice 'C-032 outbox idempotency (dedup+claim+backoff) + process_interest/send_chat_message enqueue ready.'; end $$;
