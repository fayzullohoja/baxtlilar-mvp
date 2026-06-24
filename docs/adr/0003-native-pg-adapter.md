# ADR-0003: Native pg adapter вместо Supabase

- **Status:** Accepted
- **Date:** 2026-05-15
- **Owner:** founder

## Context

Стартовали на Supabase (PostgREST + storage + auth). Проблемы по мере роста:
- Cost: Supabase Pro $25/mo + per-row egress на verified-фотках растёт быстро.
- Storage signed-URL TTL гибкость ограничена.
- RLS-режим debug сложен; половина query пишется как server-side через `service_role`
  — фактически без RLS.
- Vendor lock + латентность Supabase API из Москвы/Ташкента.

Альтернатива — Railway + native `pg.Pool`:
- Postgres напрямую (один процесс Next.js + Postgres + Volume).
- Storage = Railway Volume + локальный signed-URL (HMAC).
- Дешевле, быстрее, контроль.

## Decision

Перенесли на Railway:
- БД — Railway Postgres.
- Объекты — Railway Volume.
- App — Railway Next.js worker.

Чтобы НЕ переписывать 60+ call-site с `supabaseAdmin().from()` — тонкий адаптер:
- `src/lib/db/query-builder.ts` реализует подмножество PostgREST API
  (`.from()/.rpc()/.storage`).
- `src/lib/supabase/admin.ts` — fasade, имя сохранено, под капотом — pg.
- Запросы параметризуются через `$n` (анти-SQL-injection), идентификаторы — regex.

## Consequences

- (+) Cost снижен ~70%.
- (+) Latency P50 → −150ms (нет PostgREST hop).
- (+) Контроль БД: можем напрямую `psql`, тригеры, расширения (`pg_cron`, `pgcrypto`).
- (+) RPC-логика жирная (атомарные `admin_blocking_reject`, `claim_export_window`,
  `claim_start_token` и т.д.) — это правильно.
- (−) `supabaseAdmin()` — misleading name, нужно объяснять новичкам.
- (−) Storage cleanup orphan-файлов нужно крутить самим (cron).
- (−) Backup — Railway snapshots, без PITR.

## Реализация

- `src/lib/db/pool.ts`, `query-builder.ts`, `pg-types.ts`.
- `src/lib/storage/fs-store.ts` — file-based storage с HMAC signed-URL.
- `supabase/migrations/` название каталога осталось историческое — это просто SQL-файлы
  применяемые через psql.

## Followup

- Переименовать `supabase/migrations/` → `db/migrations/`? Или `migrations/`? Низкий
  приоритет, low confusion.
- pg_cron для periodic cleanup (gc_start_token_uses, orphan storage).
