-- REV-1/2 — grant_plan идемпотентен (двойной webhook-replay = один grant),
-- открывает залоченный чат, ставит base_plan + подписку; expire_subscriptions
-- откатывает в free по истечении, НЕ ре-локая открытый чат.

begin;

do $$
declare
  ua uuid; ub uuid; ch uuid; sess uuid;
  r jsonb; n int; subs int;
begin
  insert into users (telegram_id, verification_status, lifecycle_state)
    values (990010001, 'approved', 'active') returning id into ua;
  insert into users (telegram_id, verification_status, lifecycle_state)
    values (990010002, 'approved', 'active') returning id into ub;

  -- залоченный чат (новая пара без Plus)
  insert into chats (user_a, user_b, status, locked_at)
    values (least(ua,ub), greatest(ua,ub), 'locked_requires_plus', now())
    returning id into ch;

  -- pending платёжная сессия ua на Plus 30 дней, привязана к чату
  insert into payment_sessions (user_id, plan, duration_days, amount, provider, chat_id, source_screen)
    values (ua, 'plus', 30, 14900000, 'click', ch, 'chat_paywall')
    returning id into sess;

  -- 1) grant → granted, чат открыт, base_plan=plus, подписка активна
  r := grant_plan(sess);
  if r->>'result' <> 'granted' then raise exception 'ожидался granted, %', r; end if;
  if (select status from chats where id = ch) <> 'open' then
    raise exception 'чат должен открыться'; end if;
  if (select base_plan::text from users where id = ua) <> 'plus' then
    raise exception 'base_plan должен стать plus'; end if;
  if (select plan_expires_at from users where id = ua) <= now() then
    raise exception 'plan_expires_at должен быть в будущем'; end if;
  if (select status from payment_sessions where id = sess) <> 'paid' then
    raise exception 'сессия должна стать paid'; end if;
  select count(*) into subs from subscriptions where user_id = ua and status='active';
  if subs <> 1 then raise exception 'ожидалась 1 активная подписка, %', subs; end if;

  -- 2) ПОВТОРНЫЙ grant (webhook replay) → already_granted, без второй подписки
  r := grant_plan(sess);
  if r->>'result' <> 'already_granted' then raise exception 'повтор: ожидался already_granted, %', r; end if;
  select count(*) into subs from subscriptions where user_id = ua;
  if subs <> 1 then raise exception 'повтор не должен плодить подписки, %', subs; end if;

  -- 3) несуществующая сессия → not_found
  r := grant_plan(gen_random_uuid());
  if r->>'result' <> 'not_found' then raise exception 'ожидался not_found, %', r; end if;

  -- 4) истечение: срок в прошлом → expire откатывает в free, чат остаётся open
  update users set plan_expires_at = now() - interval '1 day' where id = ua;
  update subscriptions set expires_at = now() - interval '1 day' where user_id = ua;
  n := expire_subscriptions();
  if n < 1 then raise exception 'expire должен затронуть >=1 юзера, %', n; end if;
  if (select base_plan::text from users where id = ua) <> 'free' then
    raise exception 'base_plan должен вернуться в free'; end if;
  if (select status from subscriptions where user_id = ua order by created_at desc limit 1) <> 'expired' then
    raise exception 'подписка должна стать expired'; end if;
  if (select status from chats where id = ch) <> 'open' then
    raise exception 'expire НЕ должен ре-локать открытый чат'; end if;

  raise notice 'REV grant_plan/expire OK';
end $$;

rollback;
