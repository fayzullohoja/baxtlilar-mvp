-- C-026: accept_interest — атомарный accept (статус+чат+outbox в одной транзакции),
-- один чат на пару, идемпотентность «20 повторов = 1 чат».
begin;
set local search_path = public;
create temp sequence _ai_tid;

create or replace function _ai_user() returns uuid language plpgsql as $$
declare uid uuid := gen_random_uuid();
begin
  insert into users(id, telegram_id, lifecycle_state, onboarding_step, verification_status)
  values (uid, nextval('_ai_tid'), 'active', 'active', 'approved');
  return uid;
end$$;

do $$
declare
  a uuid; b uuid; c uuid; req uuid; res record; n int; ob int; va uuid; vb uuid;
begin
  -- ── базовый accept: статус + чат + уведомление ──
  a := _ai_user(); b := _ai_user();
  insert into match_requests(sender_id, receiver_id, status, auto_decline_at)
    values (a, b, 'pending', now() + interval '10 hour') returning id into req;

  select * into res from accept_interest(req, b);
  assert res.result = 'accepted', 'accept → accepted, got ' || res.result;
  assert res.chat_id is not null, 'chat_id должен быть';
  assert res.outbox_id is not null, 'outbox_id должен быть (enqueue в транзакции)';
  assert (select status::text from match_requests where id = req) = 'accepted', 'статус accepted';

  va := least(a, b); vb := greatest(a, b);
  select count(*) into n from chats where user_a = va and user_b = vb;
  assert n = 1, 'ровно 1 чат на пару, got ' || n;
  select count(*) into ob from tg_outbox where user_id = a and event_type = 'interest_accepted';
  assert ob = 1, 'ровно 1 уведомление отправителю, got ' || ob;

  -- ── 20 повторов = 1 чат + 1 уведомление (идемпотентность) ──
  -- ПОСЛЕДОВАТЕЛЬНЫЙ повтор: pre-lock видит status='accepted' → not_pending
  -- (вызывающий уже получил чат первым успехом). Инвариант — ни второго чата,
  -- ни второго уведомления. (Идемпотентный-accepted путь v_updated=0 достижим
  -- лишь в ПАРАЛЛЕЛЬНОЙ гонке двух accept/встречного process_interest — его
  -- single-session psql не воспроизводит; корректность там by-construction.)
  for i in 1..20 loop
    select * into res from accept_interest(req, b);
    assert res.result = 'not_pending', 'повтор accept → not_pending, got ' || res.result;
  end loop;
  select count(*) into n from chats where user_a = va and user_b = vb;
  assert n = 1, 'после 20 повторов всё ещё 1 чат, got ' || n;
  select count(*) into ob from tg_outbox where user_id = a and event_type = 'interest_accepted';
  assert ob = 1, 'после 20 повторов всё ещё 1 уведомление, got ' || ob;

  -- ── forbidden: принимает не получатель ──
  a := _ai_user(); b := _ai_user(); c := _ai_user();
  insert into match_requests(sender_id, receiver_id, status, auto_decline_at)
    values (a, b, 'pending', now() + interval '10 hour') returning id into req;
  select * into res from accept_interest(req, c);
  assert res.result = 'forbidden', 'чужой accept → forbidden, got ' || res.result;
  assert (select status::text from match_requests where id = req) = 'pending', 'статус не тронут';

  -- ── not_found ──
  select * into res from accept_interest(gen_random_uuid(), b);
  assert res.result = 'not_found', 'несуществующая заявка → not_found';

  -- ── expired: просроченная не создаёт чат ──
  a := _ai_user(); b := _ai_user();
  insert into match_requests(sender_id, receiver_id, status, auto_decline_at)
    values (a, b, 'pending', now() - interval '1 hour') returning id into req;
  select * into res from accept_interest(req, b);
  assert res.result = 'expired', 'просроченная → expired, got ' || res.result;
  assert (select status::text from match_requests where id = req) = 'expired', 'статус expired';
  va := least(a, b); vb := greatest(a, b);
  select count(*) into n from chats where user_a = va and user_b = vb;
  assert n = 0, 'просроченная не создаёт чат';

  raise notice '✓ ai1 accept_interest atomic: all asserts pass';
end$$;

drop function _ai_user();
rollback;
