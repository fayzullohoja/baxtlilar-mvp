-- C-032: outbox идемпотентность/надёжность — дедуп enqueue, claim ставит
-- locked_until, залоченная/отложенная исключаются, process_interest enqueue'ит
-- уведомление в своей транзакции. (Истинный конкурентный SKIP LOCKED single-
-- session psql не воспроизводит — проверяем наблюдаемые прокси.)
begin;
set local search_path = public;
create temp sequence _oi_tid;

create or replace function _oi_user() returns uuid language plpgsql as $$
declare uid uuid := gen_random_uuid();
begin
  insert into users(id, telegram_id, lifecycle_state, onboarding_step, verification_status)
  values (uid, nextval('_oi_tid'), 'active', 'active', 'approved');
  return uid;
end$$;

-- 1) enqueue дедуп по dedup_key; NULL не конфликтует
do $$
declare u uuid := _oi_user(); id1 uuid; id2 uuid; n int;
begin
  id1 := enqueue_tg_outbox(u, 'new_interest', '{}'::jsonb, 'k1');
  id2 := enqueue_tg_outbox(u, 'new_interest', '{}'::jsonb, 'k1');
  assert id1 is not null, 'первый enqueue создаёт строку';
  assert id2 is null, 'повтор того же dedup_key → null (дедуп, без дубля)';
  select count(*) into n from tg_outbox where dedup_key = 'k1';
  assert n = 1, 'ровно 1 строка на dedup_key, got ' || n;

  perform enqueue_tg_outbox(u, 'new_message', '{}'::jsonb, null);
  perform enqueue_tg_outbox(u, 'new_message', '{}'::jsonb, null);
  select count(*) into n from tg_outbox where user_id = u and event_type = 'new_message';
  assert n = 2, 'NULL dedup_key не конфликтует (2 строки), got ' || n;
end$$;

-- 2) claim ставит locked_until в будущее; повторный claim исключает залоченную
do $$
declare u uuid := _oi_user(); oid uuid; cnt int; lu timestamptz;
begin
  oid := enqueue_tg_outbox(u, 'new_interest', '{}'::jsonb, 'claim1');
  perform 1 from claim_tg_outbox(50, 60); -- клеймим пачку (включая oid)
  select locked_until into lu from tg_outbox where id = oid;
  assert lu is not null and lu > now(), 'claim поставил locked_until в будущее';
  select count(*) into cnt from claim_tg_outbox(50, 60) c where c.id = oid;
  assert cnt = 0, 'залоченная строка (locked_until future) исключена из повторного claim';
end$$;

-- 3) next_attempt_at в будущем (backoff) исключает из claim
do $$
declare u uuid := _oi_user(); oid uuid; cnt int;
begin
  oid := enqueue_tg_outbox(u, 'new_interest', '{}'::jsonb, 'backoff1');
  update tg_outbox set next_attempt_at = now() + interval '10 min' where id = oid;
  select count(*) into cnt from claim_tg_outbox(50, 60) c where c.id = oid;
  assert cnt = 0, 'отложенная (next_attempt_at future) исключена из claim';
end$$;

-- 4) claim_tg_outbox_one клеймит одну строку, повторно — пусто
do $$
declare u uuid := _oi_user(); oid uuid; cnt int;
begin
  oid := enqueue_tg_outbox(u, 'new_interest', '{}'::jsonb, 'one1');
  select count(*) into cnt from claim_tg_outbox_one(oid, 60);
  assert cnt = 1, 'claim_one вернул строку';
  select count(*) into cnt from claim_tg_outbox_one(oid, 60);
  assert cnt = 0, 'повторный claim_one той же строки → пусто (залочена)';
end$$;

-- 5) process_interest: 'sent' enqueue'ит new_interest В ТОЙ ЖЕ транзакции
do $$
declare a uuid := _oi_user(); b uuid := _oi_user(); res record; n int;
begin
  select * into res from process_interest(a, b, null, 72, 10);
  assert res.result = 'sent', 'process_interest → sent, got ' || res.result;
  assert res.outbox_id is not null, 'sent enqueue-ит уведомление в транзакции (не dual-write)';
  select count(*) into n from tg_outbox where user_id = b and event_type = 'new_interest';
  assert n = 1, 'ровно 1 new_interest получателю, got ' || n;
end$$;

-- 6) process_interest: встречный интерес → 'mutual' + mutual_match
do $$
declare a uuid := _oi_user(); b uuid := _oi_user(); res record; n int;
begin
  insert into match_requests(sender_id, receiver_id, status, auto_decline_at)
    values (b, a, 'pending', now() + interval '10 hour');
  select * into res from process_interest(a, b, null, 72, 10);
  assert res.result = 'mutual', 'встречный → mutual, got ' || res.result;
  assert res.chat_id is not null, 'mutual открывает чат';
  assert res.outbox_id is not null, 'mutual enqueue-ит mutual_match';
  select count(*) into n from tg_outbox where user_id = b and event_type = 'mutual_match';
  assert n = 1, 'ровно 1 mutual_match, got ' || n;
end$$;

-- 7) send_chat_message: атомарно сообщение + дебаунс + enqueue new_message
do $$
declare a uuid := _oi_user(); b uuid := _oi_user(); chat uuid; res record; n int;
begin
  insert into chats(user_a, user_b) values (least(a, b), greatest(a, b)) returning id into chat;

  -- первое сообщение от a → пуш + 1 new_message получателю b
  select * into res from send_chat_message(chat, a, 'hi');
  assert res.message_id is not null, 'сообщение создано';
  assert res.should_push = true, 'первое сообщение → should_push';
  assert res.outbox_id is not null, 'enqueue new_message в транзакции';
  select count(*) into n from tg_outbox where user_id = b and event_type = 'new_message';
  assert n = 1, 'ровно 1 new_message получателю, got ' || n;

  -- второе подряд (b ещё не прочитал) → дебаунс: без пуша, без нового outbox
  select * into res from send_chat_message(chat, a, 'hi2');
  assert res.should_push = false, 'второе подряд → дебаунс, без пуша';
  assert res.outbox_id is null, 'дебаунс не enqueue-ит';
  select count(*) into n from tg_outbox where user_id = b and event_type = 'new_message';
  assert n = 1, 'дебаунс: всё ещё 1 new_message, got ' || n;

  -- b прочитал → следующее снова пушит
  update chat_messages set read_at = now() where chat_id = chat and sender_id = a;
  select * into res from send_chat_message(chat, a, 'hi3');
  assert res.should_push = true, 'после прочтения снова should_push';
  select count(*) into n from tg_outbox where user_id = b and event_type = 'new_message';
  assert n = 2, 'после прочтения — 2 new_message, got ' || n;

  -- отправитель НЕ участник чата → пусто (роут → 500), сообщение не создаётся
  select count(*) into n from send_chat_message(chat, _oi_user(), 'intruder');
  assert n = 0, 'не-участник → пусто';
end$$;

drop function _oi_user();
rollback;
do $$ begin raise notice '✓ oi1 outbox idempotency OK'; end $$;
