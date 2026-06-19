# Baxtlilar

Telegram Mini App для серьёзных знакомств в Узбекистане (верифицированный дейтинг).

Полный путь пользователя:
- **В Telegram-боте `@baxtlilar_uz_bot`** — `/start` → язык → телефон через `request_contact` (TG уже верифицировал, SMS не шлём) → согласие на ПД → отдельное согласие на биометрию → deep-link открывает мини-аппу.
- **В мини-аппе** — паспорт → селфи → модерация → одобрено → анкета → опрос на совместимость → active → лента → интерес → взаимность → чат.

Плюс админка (модерация фото/документов/жалоб, бан/анбан, аналитика) и safety (блокировки, жалобы, анти-контакт-фильтр).

## Стек

- **Next.js 16** (App Router, async cookies/headers/params) · React 19 · TypeScript strict · Tailwind v4
- **Postgres напрямую** через node-`pg` (`src/lib/db/`) — без Supabase/PostgREST
- **Файловое хранилище** на Railway Volume (`src/lib/storage/`) — приватные фото/документы отдаются только через подписанный (HMAC+TTL) роут `/api/storage/o/...`
- Auth: Telegram **initData (HMAC-SHA256)** + httpOnly cookie session
- next-intl 4 (RU/UZ) · Vitest · Zod
- Хостинг: **Railway** (Nixpacks, Node 22, pnpm 10)

> Раньше проект работал на Vercel + Supabase; мигрирован на Railway + native Postgres.
> Подробности слоя данных и деплоя — в [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Локальный запуск

```bash
pnpm install
cp .env.local.example .env.local   # заполни DATABASE_URL и SESSION_SECRET
# накати схему в свой Postgres:
cat $(ls supabase/migrations/*.sql | sort) | grep -v 'storage\.buckets' | psql "$DATABASE_URL"
pnpm dev                           # http://localhost:3000
```

Dev-флаги (`.env.local`): `DEV_BYPASS_TG=1` (пропустить Telegram-HMAC). **На прод не ставить.**

## Команды

```bash
pnpm typecheck    # tsc --noEmit
pnpm test:run     # vitest (CI-режим)
pnpm build        # next build
pnpm webhook:set  # регистрирует webhook бота в Telegram
railway up        # деплой на Railway (healthcheck /api/health)
```

## Структура

- `src/app/[locale]/` — экраны (онбординг, лента, чаты, профиль, настройки)
- `src/app/admin/` + `src/app/api/admin/` — админ-панель
- `src/app/api/` — серверные роуты (онбординг, матчинг, чат, storage, health)
- `src/lib/db/` — native Postgres-клиент (pool + query-builder)
- `src/lib/storage/` — файловое хранилище + подписанные ссылки
- `src/lib/state-machine/` — единственный путь смены статусов (`transition()`)
- `supabase/migrations/` — SQL-миграции (обычный Postgres; имя каталога историческое)

См. также [`CLAUDE.md`](CLAUDE.md) — гайдрейлы и 9 инвариантов.
