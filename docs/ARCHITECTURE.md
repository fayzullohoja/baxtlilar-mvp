# Baxtlilar — архитектура (актуально)

Документ описывает **реально работающий код** после миграции с Vercel + Supabase на
Railway + native Postgres. История миграции — в конце.

## 1. Обзор

Telegram Mini App. Один Next.js 16 процесс обслуживает:
- пользовательские экраны и API (`src/app/[locale]`, `src/app/api`),
- админ-панель (`src/app/admin`, `src/app/api/admin`),
- отдачу приватных файлов (`/api/storage/o/...`).

Доступ к данным — только с сервера (service-уровень, RLS off). Браузер ходит в API/server
actions; БД из браузера не дёргается.

## 2. Слой данных (native Postgres)

Исторически код написан под `@supabase/supabase-js`. Чтобы не переписывать 60+ call-site'ов,
зависимость от Supabase/PostgREST заменена тонким адаптером поверх node-`pg` с **той же
поверхностью** `supabaseAdmin().from()/.rpc()/.storage`.

- **`src/lib/db/pool.ts`** — единый `pg.Pool` из `DATABASE_URL` (на внутренней сети Railway —
  без SSL; внешний хост — `PGSSL=require`).
- **`src/lib/db/query-builder.ts`** — реализует используемое подмножество PostgREST:
  - операции: `select` / `insert` / `update` / `upsert` (`onConflict`, `ignoreDuplicates`) / `delete`;
  - фильтры: `eq` `neq` `gt` `gte` `lt` `lte` `in` `is` `not`;
  - модификаторы: `order({ascending})`, `limit`;
  - терминалы: `single()` (ошибка `PGRST116` при ≠1) / `maybeSingle()` / `await` (массив) / `RETURNING` через `.select()`;
  - `select(col, { count:'exact', head:true })` → `count`;
  - **безопасность**: все значения параметризуются (`$n`), идентификаторы валидируются регуляркой.
- **`.rpc(name, params)`** — зовёт Postgres-функцию именованными аргументами
  (`fn(p_x => $1, ...)`). Набор-возвращающие (`process_interest`, `get_recommendations`,
  `get_chat_list`) → массив; скалярные (`bump_quota`, `bump_otp_attempt`, `get_unread_total`,
  `transition_user`, `get_admin_demographics`) → значение.
- Тесты: `src/lib/db/query-builder.test.ts` пиннят сгенерированный SQL и шейпинг.

Атомарность критичных операций живёт **внутри** Postgres-функций (advisory-локи, `FOR UPDATE`),
поэтому один вызов = один `pool.query()` = одна транзакция. Оптимистичный concurrency для
смены статусов — через `transition_user(p_expected_updated_at)`.

## 3. Хранилище файлов (Railway Volume)

`src/lib/storage/fs-store.ts` — замена Supabase Storage. Фото/документы лежат на Railway Volume
(`STORAGE_DIR`, в проде `/data`) по путям `<bucket>/<userId>/<file>`.

- Бакеты: `profile-photos`, `user-documents` (оба приватные).
- `from(bucket)`: `upload({contentType,upsert})` · `remove` · `list` · `createSignedUrl(s)`.
- **Приватность (инвариант 1)**: публичных ссылок нет. `createSignedUrl` отдаёт
  `/api/storage/o/<bucket>/<path>?exp=<ts>&sig=<hmac>`; роут
  `src/app/api/storage/o/[bucket]/[...path]/route.ts` проверяет HMAC (ключ из `SESSION_SECRET`) и
  срок, защищает от path-traversal, затем стримит файл. TTL короткий (фото 1ч, документы 5мин).
- Тесты: `src/lib/storage/fs-store.test.ts` (подпись/tamper/срок + FS-roundtrip).

## 4. Схема и функции

`supabase/migrations/*.sql` (имя каталога историческое) — **обычный Postgres**, накатывается по
timestamp-порядку. **19 таблиц** (users, user_profiles, profile_photos, user_documents, otp_codes,
consents, quiz_*, match_requests, match_views, chats, chat_messages, daily_request_quotas,
user_state_transitions, blocks, reports, admin_*) и **10 функций** (7 RPC выше +
`get_admin_demographics`, `prevent_log_mutation`, `set_updated_at`).

Накатка на чистый Postgres:
```bash
cat $(ls supabase/migrations/*.sql | sort) | grep -v 'storage\.buckets' \
  | psql "$DATABASE_PUBLIC_URL?sslmode=require"
```
> Строки `update storage.buckets …` пропускаются: в голом Postgres схемы `storage` нет, а
> приватность теперь обеспечивает подписанный роут (см. §3).

## 5. Деплой (Railway)

Проект `compassionate-serenity`, environment `production`:
- сервис **`baxtlilar-mvp`** — Next.js (Nixpacks, Node 22, pnpm 10), Volume на `/data`,
  публичный домен `*.up.railway.app`, healthcheck `/api/health`;
- сервис **Postgres** (с томом данных) — `DATABASE_URL` приложения указывает на его внутренний адрес.

Сборка фиксируется: `packageManager: pnpm@10.33.2`, `engines.node >= 20.9`, `.nvmrc=22`,
env `NIXPACKS_NODE_VERSION=22`, конфиг `railway.json` (healthcheck + restart policy).

Env приложения: `DATABASE_URL`, `STORAGE_DIR=/data`, `SESSION_SECRET`, `TELEGRAM_BOT_TOKEN`,
`SMS_PROVIDER`, `APP_URL`. Деплой: `railway up`.

## 6. История миграции

- **Было**: хостинг Vercel (`baxtlilar-mvp`), бэкенд Supabase (Postgres + Storage + PostgREST).
- **Триггер**: Supabase-проект удалён → прод остался без БД.
- **Стало**: хостинг и БД на Railway; слой данных переписан на native `pg`, хранилище — на Volume.
  `@supabase/supabase-js` удалён из зависимостей; `supabaseAdmin()` сохранил имя и поверхность.
