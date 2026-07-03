#!/usr/bin/env node
/**
 * DB-7 — детерминированный seed ~10k пользователей для load/EXPLAIN-тестов
 * (DB-5/6/8). НИКОГДА не для прода: скрипт отказывается работать с не-локальным
 * хостом без BX_SEED_FORCE=1.
 *
 * Что сеет (всё set-based, generate_series, идемпотентно):
 *  - users: telegram_id 800000001..800000000+N, active/approved;
 *  - user_profiles: published, чередование m/f, возраст 18-35 (детерм.),
 *    partner-окно ±7 (floor 18), города Tashkent-weighted (60%);
 *  - profile_photos: 1 approved main на юзера;
 *  - quiz_results: детерминированные Big Five вектора;
 *  - пары (каждый 24-й): accepted match_request + чат + 2 сообщения (1 unread);
 *  - match_views: каждый 20-й смотрел 10 соседей; blocks: каждый 97-й.
 *
 * Usage: node scripts/seed-10k.mjs --url postgresql://... [--n 10000]
 */

import { Pool } from "pg";

const args = process.argv.slice(2);
function argOf(name, def) {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : def;
}

const N = Number(argOf("n", "10000"));
const url = argOf("url", process.env.BX_SEED_DATABASE_URL ?? "");
if (!url || !Number.isFinite(N) || N < 1) {
  console.error("usage: node scripts/seed-10k.mjs --url postgresql://... [--n 10000]");
  process.exit(2);
}

const host = new URL(url).hostname;
if (!["localhost", "127.0.0.1", "::1"].includes(host) && process.env.BX_SEED_FORCE !== "1") {
  console.error(`refusing non-local host "${host}" — seed предназначен ТОЛЬКО для тестовых БД`);
  process.exit(2);
}

const BASE = 800_000_000;

const SQL = `
begin;

-- 1) users
insert into users (telegram_id, telegram_first_name, phone_number, phone_verified, language,
                   lifecycle_state, onboarding_step, verification_status,
                   profile_completion, quiz_completion)
select ${BASE} + i, 'Seed'||i, '+99890'||lpad(i::text, 7, '0'), true, 'ru',
       'active', 'active', 'approved', 'completed', 'completed'
from generate_series(1, ${N}) i
on conflict (telegram_id) where lifecycle_state <> 'deleted' do nothing;

-- база seed-юзеров (детерминированный "возраст" из i)
create temp table _seed on commit drop as
select u.id, (u.telegram_id - ${BASE})::int as i,
       (18 + ((u.telegram_id - ${BASE}) * 7919) % 18)::int as age
from users u
where u.telegram_id between ${BASE} + 1 and ${BASE} + ${N};

-- 2) профили: m/f чередованием, окно ±7 (floor 18), Tashkent-weighted
insert into user_profiles (user_id, display_name, gender, looking_for_gender, birth_date,
                           partner_age_min, partner_age_max, status, published_at, city,
                           top_life_values, geo_preference, religion, education, bio)
select s.id,
       'Seed '||s.i,
       case when s.i % 2 = 0 then 'm' else 'f' end,
       case when s.i % 2 = 0 then 'f' else 'm' end,
       (current_date - (s.age::text||' years')::interval - '100 days'::interval)::date,
       greatest(18, s.age - 7),
       s.age + 7,
       'published', now(),
       case when s.i % 10 < 6 then 'tashkent'
            when s.i % 10 = 6 then 'samarkand'
            when s.i % 10 = 7 then 'namangan'
            when s.i % 10 = 8 then 'andijan'
            else 'bukhara' end,
       (array['family','faith','honesty','respect','kindness','responsibility','tradition',
              'education','health','career','financial_stability','community',
              'self_development','independence'])[1 + s.i % 12 : 3 + s.i % 12],
       'country', 'islam', 'higher', 'seed bio'
from _seed s
on conflict (user_id) do nothing;

-- 3) фото (approved, main)
insert into profile_photos (user_id, path, is_main, status, ord)
select s.id, 'seed/'||s.i||'.jpg', true, 'approved', 0
from _seed s
where not exists (select 1 from profile_photos pp where pp.user_id = s.id);

-- 4) quiz-вектора
insert into quiz_results (user_id, vector)
select s.id, jsonb_build_object(
  'O', (s.i * 13) % 101, 'C', (s.i * 29) % 101, 'E', (s.i * 37) % 101,
  'A', (s.i * 41) % 101, 'ES', (s.i * 53) % 101)
from _seed s
on conflict (user_id) do nothing;

-- 5) пары: каждый 24-й чётный (m) с соседкой i+1 — accepted + чат + сообщения
create temp table _pairs on commit drop as
select a.id as ma, b.id as fb
from _seed a
join _seed b on b.i = a.i + 1
where a.i % 2 = 0 and a.i % 24 = 0;

insert into match_requests (sender_id, receiver_id, status, auto_decline_at)
select p.ma, p.fb, 'accepted', now() + interval '72 hours'
from _pairs p
where not exists (select 1 from match_requests mr
                  where mr.sender_id = p.ma and mr.receiver_id = p.fb);

insert into chats (user_a, user_b)
select least(p.ma, p.fb), greatest(p.ma, p.fb) from _pairs p
on conflict (user_a, user_b) do nothing;

-- 2 сообщения на пустой seed-чат: одно прочитано, одно unread (для DB-4 индекса)
insert into chat_messages (chat_id, sender_id, body, read_at)
select ch.id, p.ma, 'Ассалому алайкум! (seed)', now() - interval '1 hour'
from _pairs p
join chats ch on ch.user_a = least(p.ma, p.fb) and ch.user_b = greatest(p.ma, p.fb)
where not exists (select 1 from chat_messages cm where cm.chat_id = ch.id);

insert into chat_messages (chat_id, sender_id, body, read_at)
select ch.id, p.fb, 'Ваалейкум ассалом! (seed)', null
from _pairs p
join chats ch on ch.user_a = least(p.ma, p.fb) and ch.user_b = greatest(p.ma, p.fb)
where (select count(*) from chat_messages cm where cm.chat_id = ch.id) < 2;

-- 6) просмотры: каждый 20-й смотрел 10 «соседей» противоположной чётности
insert into match_views (viewer_id, target_id)
select a.id, b.id
from _seed a
join generate_series(1, 10) g on true
join _seed b on b.i = a.i + 2 * g + 1
where a.i % 20 = 0
on conflict (viewer_id, target_id) do nothing;

-- 7) блокировки: каждый 97-й блокирует i+2
insert into blocks (blocker_id, blocked_id)
select a.id, b.id
from _seed a
join _seed b on b.i = a.i + 2
where a.i % 97 = 0
on conflict (blocker_id, blocked_id) do nothing;

commit;

-- статистика планировщику (DB-8: EXPLAIN без ANALYZE даёт ложные фейлы)
analyze;
`;

const pool = new Pool({ connectionString: url, max: 2 });
try {
  const t0 = Date.now();
  await pool.query(SQL);
  const { rows } = await pool.query(`
    select (select count(*) from users where telegram_id > ${BASE}) as users,
           (select count(*) from user_profiles p join users u on u.id = p.user_id
             where u.telegram_id > ${BASE} and p.status = 'published') as published,
           (select count(*) from chats) as chats,
           (select count(*) from chat_messages where read_at is null) as unread,
           (select count(*) from match_views) as views,
           (select count(*) from blocks) as blocks
  `);
  const r = rows[0];
  console.log(
    `seed done in ${((Date.now() - t0) / 1000).toFixed(1)}s: ` +
      `users=${r.users} published=${r.published} chats=${r.chats} unread=${r.unread} views=${r.views} blocks=${r.blocks}`,
  );
} finally {
  await pool.end();
}
