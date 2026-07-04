-- REV-1/2 — Revenue-MVP: Plus (149 000 сум/мес) открывает чат после mutual.
-- Источник истины подписки — subscriptions; users.base_plan/plan_expires_at
-- денормализованы для быстрых гейтов. Идемпотентность платежей — advisory lock
-- по session id + short-circuit на status='paid' + UNIQUE(provider, txn).
--
-- chats.status default 'open' — существующие пары работают, lock только на новые.

do $$ begin
  if not exists (select 1 from pg_type where typname = 'plan_tier') then
    create type plan_tier as enum ('free','plus','pro');
  end if;
end $$;

alter table users
  add column if not exists base_plan plan_tier not null default 'free',
  add column if not exists plan_expires_at timestamptz;

alter table chats
  add column if not exists status text not null default 'open'
    check (status in ('open','locked_requires_plus','expired')),
  add column if not exists locked_at timestamptz,
  add column if not exists lock_expires_at timestamptz;

create table if not exists subscriptions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references users(id) on delete cascade,
  plan          plan_tier not null,
  status        text not null default 'active' check (status in ('active','expired','cancelled')),
  provider      text,
  started_at    timestamptz not null default now(),
  expires_at    timestamptz not null,
  source_screen text,
  created_at    timestamptz not null default now()
);
create index if not exists subscriptions_user_idx on subscriptions(user_id, status);

create table if not exists payment_sessions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references users(id) on delete cascade,
  plan            plan_tier not null,
  duration_days   integer not null default 30,
  amount          bigint not null,             -- в тийинах (149000 сум = 14900000)
  currency        text not null default 'UZS',
  provider        text not null,               -- 'click' | 'payme'
  kind            text not null default 'self',
  status          text not null default 'pending' check (status in ('pending','paid','failed','expired')),
  provider_txn_id text,
  chat_id         uuid references chats(id) on delete set null,
  source_screen   text,
  created_at      timestamptz not null default now(),
  -- идемпотентность: один провайдерский платёж = одна сессия (NULL-txn не конфликтуют)
  unique (provider, provider_txn_id)
);
create index if not exists payment_sessions_user_idx on payment_sessions(user_id, status);

-- grant_plan — идемпотентный grant по факту оплаты. Advisory xact-lock по session
-- id сериализует конкурентные replay'и webhook'а; status='paid' short-circuit'ит
-- повтор. Возвращает {result, chat_id}.
create or replace function grant_plan(p_session uuid)
returns jsonb
language plpgsql
as $$
declare s payment_sessions; v_expires timestamptz; v_chat uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_session::text, 0));
  select * into s from payment_sessions where id = p_session;
  if not found then return jsonb_build_object('result', 'not_found'); end if;
  if s.status = 'paid' then
    return jsonb_build_object('result', 'already_granted', 'chat_id', s.chat_id);
  end if;

  update payment_sessions set status = 'paid' where id = p_session;
  v_expires := now() + make_interval(days => s.duration_days);

  insert into subscriptions (user_id, plan, status, provider, started_at, expires_at, source_screen)
    values (s.user_id, s.plan, 'active', s.provider, now(), v_expires, s.source_screen);

  -- денормализация: продлеваем от максимума (стек покупок не укорачивает срок)
  update users
     set base_plan = s.plan,
         plan_expires_at = greatest(coalesce(plan_expires_at, now()), v_expires)
   where id = s.user_id;

  -- открыть залоченный чат (любой стороной)
  if s.chat_id is not null then
    update chats set status = 'open', lock_expires_at = null
      where id = s.chat_id and status = 'locked_requires_plus';
    v_chat := s.chat_id;
  end if;

  return jsonb_build_object('result', 'granted', 'chat_id', v_chat);
end $$;

-- expire_subscriptions — просроченные → free; НЕ ре-локает открытые чаты
-- (оплата уже открыла — остаётся открытым). Гоняется хаускипингом.
create or replace function expire_subscriptions()
returns integer
language plpgsql
as $$
declare n integer;
begin
  update users set base_plan = 'free'
    where base_plan <> 'free'
      and plan_expires_at is not null
      and plan_expires_at < now();
  get diagnostics n = row_count;
  update subscriptions set status = 'expired'
    where status = 'active' and expires_at < now();
  return n;
end $$;
