#!/usr/bin/env bash
# Integration test harness: spins a throwaway PG16, loads ALL migrations, then runs
# vitest *.itest.ts against it through the REAL query-builder (createDbClient +
# configurePgTypes). Проверяет связку роут→query-builder→RPC вживую — тот самый
# слой, что unit/SQL-тесты не покрывают (из-за него accept_interest ушёл сломанным).
#
# Usage: bash scripts/test-db/run-integration-tests.sh
# Requires local postgresql@16 (brew). Does NOT touch prod.
set -euo pipefail

export PATH="/opt/homebrew/opt/postgresql@16/bin:${PATH}"
export LC_ALL=C
export LANG=C

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PORT="${BX_ITEST_PORT:-55434}"
PGDATA_DIR="$(mktemp -d /tmp/bxtipgd.XXXXXX)"
SOCK="$(mktemp -d /tmp/bxtipgs.XXXXXX)"
DB="postgresql://postgres@127.0.0.1:${PORT}/bxitest"
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
for i in $(seq 1 40); do psql "$ADMIN" -tAc "select 1" >/dev/null 2>&1 && break; sleep 0.3; done

psql "$ADMIN" -qc "create database bxitest;" >/dev/null

# Supabase-storage schema stub so storage-RLS migrations load on vanilla PG.
psql "$DB" -qc "create schema if not exists storage; create table if not exists storage.buckets (id text primary key, name text, public boolean default false);" >/dev/null

echo "▸ load migrations"
for f in $(ls "$REPO"/supabase/migrations/*.sql | sort); do
  psql "$DB" -v ON_ERROR_STOP=1 -qf "$f" >/dev/null 2>&1 \
    || { echo "  ✗ migration failed: $(basename "$f")"; psql "$DB" -v ON_ERROR_STOP=1 -qf "$f" 2>&1 | grep -i error | head -3; exit 1; }
done

echo "▸ run vitest integration (*.itest.ts) against seed DB"
cd "$REPO"
DATABASE_URL="$DB" pnpm exec vitest run --config vitest.integration.config.ts
