#!/usr/bin/env bash
# DB-7 smoke: поднимает ephemeral PG16 (как run-sql-tests.sh), гоняет
# scripts/seed-10k.mjs с уменьшенным N дважды (идемпотентность) и проверяет:
#  - количества (users/profiles/photos/quiz);
#  - у среднего по возрасту seed-юзера строгий фид НЕ пуст и есть viewer >100
#    кандидатов (acceptance DB-5/6 не должен быть vacuous);
#  - чаты с непрочитанными существуют;
#  - повторный прогон не меняет количеств.
#
# Usage: bash scripts/test-db/smoke-seed.sh [N]   (default 300)
set -euo pipefail

export PATH="/opt/homebrew/opt/postgresql@16/bin:${PATH}"
export LC_ALL=C
export LANG=C

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
N="${1:-300}"
PORT="${BX_TEST_PORT:-55433}"
PGDATA_DIR="$(mktemp -d /tmp/bxseedd.XXXXXX)"
SOCK="$(mktemp -d /tmp/bxseeds.XXXXXX)"
DB="postgresql://postgres@127.0.0.1:${PORT}/bxseed"
ADMIN="postgresql://postgres@127.0.0.1:${PORT}/postgres"

cleanup() {
  pg_ctl -D "$PGDATA_DIR/data" stop -m immediate >/dev/null 2>&1 || true
  rm -rf "$PGDATA_DIR" "$SOCK"
}
trap cleanup EXIT

echo "▸ initdb ($PGDATA_DIR)"
initdb -D "$PGDATA_DIR/data" -U postgres --no-locale --encoding=UTF8 >/dev/null 2>&1

echo "▸ start PG on :$PORT"
pg_ctl -D "$PGDATA_DIR/data" \
  -o "-p $PORT -k $SOCK -c listen_addresses=127.0.0.1" \
  -l "$PGDATA_DIR/log" start >/dev/null 2>&1
for i in $(seq 1 20); do psql "$ADMIN" -tAc "select 1" >/dev/null 2>&1 && break; sleep 0.3; done

psql "$ADMIN" -qc "create database bxseed;" >/dev/null
psql "$DB" -qc "create schema if not exists storage; create table if not exists storage.buckets (id text primary key, name text, public boolean default false);" >/dev/null

echo "▸ load migrations"
for f in $(ls "$REPO"/supabase/migrations/*.sql | sort); do
  psql "$DB" -v ON_ERROR_STOP=1 -qf "$f" >/dev/null 2>&1 \
    || { echo "  ✗ migration failed: $(basename "$f")"; exit 1; }
done

echo "▸ seed run #1 (N=$N)"
node "$REPO/scripts/seed-10k.mjs" --url "$DB" --n "$N"

echo "▸ assertions"
psql "$DB" -v ON_ERROR_STOP=1 -qc "
do \$\$
declare
  n_users int; n_prof int; n_photos int; n_quiz int; n_chats int; n_unread int;
  mid uuid; feed int; maxfeed int;
begin
  select count(*) into n_users from users where telegram_id between 800000001 and 800000000 + ${N};
  if n_users <> ${N} then raise exception 'users: ожидалось ${N}, получено %', n_users; end if;

  select count(*) into n_prof from user_profiles p join users u on u.id = p.user_id
    where u.telegram_id > 800000000 and p.status = 'published';
  if n_prof <> ${N} then raise exception 'published profiles: ожидалось ${N}, %', n_prof; end if;

  select count(*) into n_photos from profile_photos pp join users u on u.id = pp.user_id
    where u.telegram_id > 800000000 and pp.status = 'approved';
  if n_photos < ${N} then raise exception 'approved photos: ожидалось >= ${N}, %', n_photos; end if;

  select count(*) into n_quiz from quiz_results q join users u on u.id = q.user_id
    where u.telegram_id > 800000000;
  if n_quiz <> ${N} then raise exception 'quiz_results: ожидалось ${N}, %', n_quiz; end if;

  select count(*) into n_chats from chats;
  if n_chats < 5 then raise exception 'chats: ожидалось >= 5, %', n_chats; end if;
  select count(*) into n_unread from chat_messages where read_at is null;
  if n_unread < 5 then raise exception 'unread messages: ожидалось >= 5, %', n_unread; end if;

  -- строгий фид у среднего по возрасту юзера не пуст; есть viewer с >100 кандидатами
  select max(cnt) into maxfeed from (
    select (select count(*) from get_recommendations(u.id, 1000, 0)) as cnt
    from users u
    where u.telegram_id between 800000000 + (${N}/2) - 10 and 800000000 + (${N}/2) + 10
  ) t;
  if maxfeed is null or maxfeed = 0 then raise exception 'strict feed пуст у mid-age юзеров'; end if;
  if ${N} >= 300 and maxfeed <= 100 then
    raise exception 'ожидался viewer с >100 кандидатов (DB-5/6 acceptance), max=%', maxfeed;
  end if;

  raise notice 'seed OK: users=% profiles=% photos=% quiz=% chats=% unread=% maxfeed=%',
    n_users, n_prof, n_photos, n_quiz, n_chats, n_unread, maxfeed;
end \$\$;"

echo "▸ DB-8 EXPLAIN: sargable birth_date range использует user_profiles_reco_idx"
# Узкий возрастной диапазон → индекс однозначно выгоднее seq scan. Доказывает,
# что DB-5 сделал возрастной фильтр sargable (до DB-5 age()-предикат этого не мог).
LO=$(psql "$DB" -tAc "select (current_date - make_interval(years => 31) + interval '1 day')::date")
HI=$(psql "$DB" -tAc "select (current_date - make_interval(years => 29))::date")
PLAN=$(psql "$DB" -tAc "explain (format text) select user_id from user_profiles where gender='f' and looking_for_gender='m' and status='published' and birth_date between '$LO' and '$HI'")
echo "$PLAN" | sed 's/^/    /'
if echo "$PLAN" | grep -qi "Seq Scan on user_profiles"; then
  echo "  ✗ Seq Scan на user_profiles — индекс не работает"; exit 1; fi
if ! echo "$PLAN" | grep -qi "user_profiles_reco_idx"; then
  echo "  ✗ user_profiles_reco_idx не использован"; exit 1; fi
echo "  ✓ reco_idx используется на sargable-диапазоне"

echo "▸ DB-8 EXPLAIN: get_recommendations mid-age viewer (план + время)"
VID=$(psql "$DB" -tAc "select id from users where telegram_id = 800000000 + (${N}/2)")
psql "$DB" -tAc "explain (analyze, timing off, summary on, format text) select * from get_recommendations('$VID'::uuid, 20, 0)" | sed 's/^/    /' | tail -6

echo "▸ seed run #2 (идемпотентность)"
BEFORE=$(psql "$DB" -tAc "select (select count(*) from users) || '/' || (select count(*) from user_profiles) || '/' || (select count(*) from profile_photos) || '/' || (select count(*) from chats) || '/' || (select count(*) from chat_messages) || '/' || (select count(*) from match_requests) || '/' || (select count(*) from match_views) || '/' || (select count(*) from blocks)")
node "$REPO/scripts/seed-10k.mjs" --url "$DB" --n "$N" >/dev/null
AFTER=$(psql "$DB" -tAc "select (select count(*) from users) || '/' || (select count(*) from user_profiles) || '/' || (select count(*) from profile_photos) || '/' || (select count(*) from chats) || '/' || (select count(*) from chat_messages) || '/' || (select count(*) from match_requests) || '/' || (select count(*) from match_views) || '/' || (select count(*) from blocks)")
if [ "$BEFORE" != "$AFTER" ]; then
  echo "  ✗ идемпотентность нарушена: $BEFORE -> $AFTER"
  exit 1
fi
echo "  ✓ идемпотентно ($AFTER)"

echo "▸ guard: отказ на не-локальный URL"
if node "$REPO/scripts/seed-10k.mjs" --url "postgresql://u:p@containers.railway.app:5432/db" --n 1 >/dev/null 2>&1; then
  echo "  ✗ guard не сработал (посеял бы прод!)"
  exit 1
fi
echo "  ✓ не-локальный URL отвергнут"

echo "▸ DB-7 smoke: PASS"
