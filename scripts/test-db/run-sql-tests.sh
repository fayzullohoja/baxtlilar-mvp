#!/usr/bin/env bash
# Ephemeral-Postgres integration test harness for SQL-level tests (triggers, RPCs,
# constraints). Spins a throwaway PG16 cluster, loads all migrations, runs every
# supabase/tests/*.test.sql with ON_ERROR_STOP (a RAISE EXCEPTION = failure), tears down.
#
# Usage: bash scripts/test-db/run-sql-tests.sh [test-file.sql ...]
#   no args → run all supabase/tests/*.test.sql
#
# Requires local postgresql@16 (brew). Does NOT touch prod.
set -euo pipefail

export PATH="/opt/homebrew/opt/postgresql@16/bin:${PATH}"
export LC_ALL=C
export LANG=C

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PORT="${BX_TEST_PORT:-55432}"
PGDATA_DIR="$(mktemp -d /tmp/bxtpgd.XXXXXX)"
SOCK="$(mktemp -d /tmp/bxtpgs.XXXXXX)"
DB="postgresql://postgres@127.0.0.1:${PORT}/bxtest"
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

psql "$ADMIN" -qc "create database bxtest;" >/dev/null

# Supabase-storage schema stub so storage-RLS migrations load on vanilla PG.
psql "$DB" -qc "create schema if not exists storage; create table if not exists storage.buckets (id text primary key, name text, public boolean default false);" >/dev/null

echo "▸ load migrations"
for f in $(ls "$REPO"/supabase/migrations/*.sql | sort); do
  psql "$DB" -v ON_ERROR_STOP=1 -qf "$f" >/dev/null 2>&1 \
    || { echo "  ✗ migration failed: $(basename "$f")"; psql "$DB" -v ON_ERROR_STOP=1 -qf "$f" 2>&1 | grep -i error | head -3; exit 1; }
done

if [ "$#" -gt 0 ]; then
  TESTS=("$@")
else
  TESTS=()
  for t in "$REPO"/supabase/tests/*.test.sql; do [ -e "$t" ] && TESTS+=("$t"); done
fi

FAIL=0
echo "▸ run ${#TESTS[@]} test(s)"
for t in "${TESTS[@]}"; do
  [ -f "$t" ] || t="$REPO/supabase/tests/$t"
  if psql "$DB" -v ON_ERROR_STOP=1 -qf "$t" >/tmp/bxtest_out 2>&1; then
    echo "  ✓ $(basename "$t")"
    grep -i notice /tmp/bxtest_out | sed 's/^/      /' || true
  else
    echo "  ✗ $(basename "$t")"
    grep -iE "error|exception" /tmp/bxtest_out | head -4 | sed 's/^/      /'
    FAIL=$((FAIL+1))
  fi
done

echo "▸ done: $(( ${#TESTS[@]} - FAIL ))/${#TESTS[@]} passed"
exit $FAIL
