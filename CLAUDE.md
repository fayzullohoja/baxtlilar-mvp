@AGENTS.md

# Baxtlilar — гайдрейлы для Claude Code

## Что это
Telegram Mini App для серьёзных знакомств в Узбекистане.
**Полные спеки:** докстор, `shared/17. Baxtlilar` (Чат 1-13 + Excel-бэклог + пояснительная
записка). Достать: `ofdoc get "shared/17. Baxtlilar/<путь>" <файл>`; список - `ofdoc tree "shared/17. Baxtlilar" 3`.
Локальная копия для чтения: `~/Desktop/Все файлы/Baxtlilar/спеки/` (см. README там же).
Прежний путь `~/Desktop/Baxtlilar/` - от старой машины, его больше нет.

**План разработки:** файла `~/.claude/plans/sequential-popping-crayon.md` больше не существует,
и копии не сохранилось - он был на старой машине. Действующие планы лежат в самом репозитории:
`docs/p0-implementation-plan-2026-07-02.md`, `docs/admin-plan-2026-07-04.md`,
`docs/owner-feedback-plan-2026-07-07.md`, `docs/review-plan-2026-07-09.md`.

## Локальная разработка (собрано 18.08.2026)

Окружение на этой машине уже поднято: Postgres 16 через brew (`baxtlilar_dev`, все 107
миграций накачены), `.env.local` заполнен, засеяно 200 тестовых юзеров.

```bash
corepack pnpm dev                  # репо пинит pnpm 10.33.2, поэтому через corepack
node scripts/dev-session.mjs       # выдать сессию мини-аппы в обход бота
node scripts/dev-session.mjs --browser   # то же, но сниппет для консоли браузера
node scripts/seed-10k.mjs --url "$DATABASE_URL" --n 200   # пересеять данные
```

`TELEGRAM_BOT_TOKEN` в `.env.local` - **заглушка**, не боевой токен. Схема env требует
>=20 символов, иначе падает весь конфиг и `/api/health` отдаёт 503 с обманчивым текстом
«db check failed». С заглушкой не работает бот-плечо целиком: `/start`, webhook,
`request_contact`, deep-link, любые вызовы Bot API. Мини-аппа при этом открывается через
`DEV_BYPASS_TG=1` + `scripts/dev-session.mjs`.

## Документация: где что живёт (с 2026-06-21)

| Где | Что |
|---|---|
| `docs/adr/` | Architecture Decision Records — технические развилки (БД, auth, framework). Новое значимое решение → новая ADR. Старые не редактируются, только статус. |
| `docs/runbooks/` | Операционные сценарии: deploy, DB ops, инциденты. |
| `docs/security/` | Сводка security-постуры; полные аудиты остаются в `_audit/`. |
| `docs/ARCHITECTURE.md` | Single-source-of-truth по архитектуре. |
| `docs/improvement-log.md` | Журнал /loop-цикла улучшений. |
| `_audit/` (корень) | Полные security/onboarding-аудиты, история раундов adversarial verify. |
| **Notion workspace «Baxtlilar»** | Продуктовая стратегия, user research, design system, IA, roadmap, decisions (продуктовые), meeting notes, юр-вопросы. Структура: Home → Product / Design / Competitors (DB) / Decisions Log (DB) / Engineering (зеркало docs/) / Legal. |

**Правило:** код → ADR в repo; продукт → Notion. Если новая значимая дизайн-решение
обсуждается с юристом — туда же в Notion → Legal. Если pure-tech — ADR.

## Стек
- Next.js 16 (App Router, **async** cookies/headers/params; Server Actions возвращают void/Promise<void>)
- React 19 · TypeScript strict · Tailwind v4
- **Postgres напрямую** (node-`pg`, `src/lib/db/`) + файловое хранилище на **Railway Volume** (`src/lib/storage/`) — доступ только с сервера, RLS off (service-уровень). **Supabase больше НЕ используется.**
- Auth: Telegram **initData (HMAC-SHA256)** + httpOnly cookie session
- next-intl 4 (RU/UZ) · Vitest · Zod
- **Railway** (Nixpacks, Node 22, pnpm 10): один сервис `baxtlilar-mvp` + сервис Postgres + Volume `/data`; деплой `railway up`, healthcheck `/api/health`

## 9 инвариантов (нельзя нарушать)
1. Контакты защищены: телефон/документы/селфи не в публичном API.
2. Согласие важнее денег (этап 2; архитектура закладывается сразу).
3. **approved ≠ published**: модератор одобряет, публикует пользователь.
4. Чат только по взаимному интересу.
5. Не свайп-дейтинг.
6. Без ярлыков (развод/дети/доход).
7. Действия админов логируются; чувствительные данные скрыты по умолчанию.
8. Смена статуса — **только через `transition()` с записью в `user_state_transitions`**.
9. Бренд: коралл `#E2526B` на белом; запреты — см. Чат 13 Часть 4.

## Данные и хранилище (native, не Supabase)
- `supabaseAdmin()` (`src/lib/supabase/admin.ts`) — историческое имя; теперь это **native-клиент** поверх node-`pg` + файлового хранилища. Поверхность `.from()/.rpc()/.storage` сохранена, поэтому call-site'ы не трогаем.
- `src/lib/db/query-builder.ts` — мини query-builder под используемое подмножество PostgREST (select/insert/update/upsert/delete · eq/neq/gt/gte/lt/lte/in/is/not · order/limit · single/maybeSingle · count+head · RETURNING · `.rpc()` именованными аргументами). Все значения параметризуются, идентификаторы валидируются.
- `.rpc(name, …)` зовёт ту же Postgres-функцию: `process_interest`/`get_recommendations`/`get_chat_list` возвращают набор (массив), остальные — скаляр.
- `src/lib/storage/fs-store.ts` — фото/документы на Railway Volume (`STORAGE_DIR=/data`); приватность через подписанный (HMAC+TTL) роут `/api/storage/o/<bucket>/<path>` — НЕ публичные ссылки.
- Миграции `supabase/migrations/*.sql` — обычный Postgres; накатываются по timestamp-порядку через `psql` (строки `storage.buckets` пропускаются — в голом PG их нет).

## Чего НЕ делать
- Не запрашивать БД из браузера; только через server actions / API-роуты с `supabaseAdmin()` (native-клиент).
- Не bypass'ить `transition()` прямым UPDATE статусов.
- Не возвращать ошибки из server actions объектами — `redirect(...?error=...)`.
- Не класть секреты в `NEXT_PUBLIC_*` env-vars.
- Не отдавать фото/документы публично — только через подписанный `/api/storage/...` (инвариант 1).

## Команды
```
pnpm dev          # локальный dev (нужен DATABASE_URL → локальный Postgres)
pnpm test         # vitest unit (watch)
pnpm test:run     # CI-режим (run once)
pnpm typecheck    # tsc --noEmit
pnpm lint         # eslint
pnpm build        # next build
railway up        # деплой на Railway (Nixpacks, healthcheck /api/health)
# накатить миграции: psql "$DATABASE_PUBLIC_URL?sslmode=require" -f <combined.sql>
```

## Env (обязательные)
`DATABASE_URL` (Postgres), `STORAGE_DIR` (на Railway `/data`), `SESSION_SECRET` (32+), `TELEGRAM_BOT_TOKEN`, `BOT_USERNAME`, `BOT_WEBAPP_SHORT_NAME`, `TELEGRAM_WEBHOOK_SECRET` (16+). Опц.: `APP_URL`, `SUPPORT_URL`, `PGSSL=require` (для внешнего Postgres).

## Dev-флаги
- `DEV_BYPASS_TG=1` — пропустить HMAC initData в браузере (только локально; в проде НЕ ставить).

## Порядок регистрации/верификации MVP (security-pivot 2026-06-19)
1) **В боте `@baxtlilar_uz_bot`:** `/start` → язык → контакт (TG-кнопка `request_contact`, телефон уже верифицирован самим Telegram) → согласие на ПД → отдельное согласие на биометрию → deep-link открывает мини-аппу.
2) **В мини-аппе:** паспорт → селфи → модерация → одобрено → анкета → опрос → active.

SMS/OTP **выпилены полностью** — телефон даёт Telegram через `Contact.user_id == sender.id`-чек. См. `_audit/2026-06-19-security-audit.md`.

Регистрация webhook'а бота:
```
pnpm webhook:set    # читает .env.access/.env.local
```

Браузерный прямой вход в мини-аппу **заблокирован**: `proxy.ts` без `bx_session`-cookie рисует `/open-in-telegram` (кнопка → бот).
