# Baxtlilar — Хендофф сессии: редизайн админки (2026-06-27 → 28)

> Контекст-документ для переноса в основной аккаунт. Эту сессию вёл другой аккаунт
> Claude (на основном кончились лимиты). Ниже — что сделано, как, и что где лежит.
> Самодостаточно: можно поднять контекст «с нуля».

---

## 0. TL;DR

Админка Baxtlilar полностью переделана из **трёх враждующих дизайн-систем**
(тёмный editorial `V2AdminShell` + светлый `OpsShell` + navy/cyan `V1 AdminShell`)
в **единую operator-консоль `OpsShell`** (slate-blue `#2d4a5c` + Inter). Поверх
этого реализованы Sprint 1 (студия верификации + карточка клиента) и Sprint 2
(фото-модерация + директория клиентов + табы), починен живой прод-баг **H-1**,
закрыты находки adversarial-ревью, всё **смержено в `main` и задеплоено на прод**.

**Стек:** Next.js 16 (App Router, `proxy.ts` вместо middleware) · React 19 · TS strict
· нативный Postgres (свой адаптер `src/lib/db`, НЕ Supabase) · Railway · Vitest.
**Репо:** `~/Code/baxtlilar`, GitHub `fayzullohoja/baxtlilar-mvp` (private).

---

## 1. Состояние git / деплоя (ВАЖНО)

| Что | Коммит | Где |
|---|---|---|
| `origin/main` (= ЗАДЕПЛОЕНО на прод) | **`66559be`** merge | Sprint 1+2 + унификация + чистка |
| Локальный `main` (НЕ запушен, +3 коммита) | `0ab5067` | A + B1 + B2 (ниже) — **ждут «деплой»** |
| Фича-ветка (запушена, для записи) | `feat/admin-redesign-sprint-1` | вся работа Sprint 1+2 |

**3 незапушенных коммита на локальном `main`:**
- `e09f526` B1 — ProfileTab (анкета в карточке клиента)
- `f61496a` A — слияние «Клиенты» + «Пользователи»
- `0ab5067` B2 — blocking-reject в студию + удаление старого verifications API (H-1)

**Деплой:** `git push origin main` → Railway авто-деплоит. Проверка: логин на
`/admin` + рендер новых экранов (или curl, см. §7). Миграции Railway НЕ запускает —
их накатывают вручную psql (все уже применены, см. §5).

> Параллельно другой аккаунт вёл правки мини-аппы на ветке `feat/miniapp-audit-fixes`
> (worktree `~/Code/baxtlilar-miniapp-fixes`) и влил в main свои Wave 1/2 (`5d2bee7`,
> `03988e6`, `51d4db5`). Слияние с админкой прошло **без конфликтов** (разные области).

---

## 2. Прод-координаты

- **App:** https://baxtlilar-mvp-production.up.railway.app · health `/api/health`
- **Admin:** https://baxtlilar-mvp-production.up.railway.app/admin
- **Логин:** `admin` / пароль в `~/Code/baxtlilar/.env.access` (`ADMIN_PASSWORD`, 12 симв.)
- **Super-admin id:** `8151f522-3467-471b-9647-35ae53784834` (роль superadmin)
- **Прод-БД (read/write через psql):** `DATABASE_PUBLIC_URL` в `.env.access`
  (public proxy `*.proxy.rlwy.net`; внутр. `DATABASE_URL` = `*.railway.internal`,
  локально НЕ резолвится — для локали юзать PUBLIC + `PGSSL=require`).

---

## 3. Как устроена админка СЕЙЧАС (что где лежит)

**Единая оболочка `OpsShell`** (`src/components/admin-ops/OpsShell.tsx`) рендерит
`OpsSidebar` + `OpsTopBar` + контент. Все `/admin/*` страницы обёрнуты в неё.

**Сайдбар (`src/components/admin-ops/OpsSidebar.tsx`)** — одна навигация, только
живые ссылки:
- **ОБЗОР:** Дашборд → `/admin`
- **МОДЕРАЦИЯ:** Верификации → `/admin/queue/mine` · Фото → `/admin/photos` · Жалобы → `/admin/reports` (super)
- **РЕЕСТР:** Клиенты → `/admin/clients` (super)
- **АНАЛИТИКА:** Аналитика → `/admin/analytics` (super) · Журнал → `/admin/audit` (super)

**Ключевые экраны:**
- **Студия верификации:** `/admin/cases/[id]` — 3 шага: документы → ввод 11
  паспортных полей (с проверкой ПИНФЛ-checksum) → сверка лица → решение
  (approve / needs_changes / reject_technical / **blocking-reject**).
  Очередь кейсов: `/admin/queue/mine` (моя + без владельца).
- **Карточка клиента:** `/admin/clients/[id]` — табы Identity / Profile / Photos /
  Activity / Moderation. Аватар = одобренное селфи. ПИНФЛ/паспорт/адрес read-only.
- **Директория клиентов:** `/admin/clients` — type-ahead поиск (ФИО/ПИНФЛ/паспорт/
  телефон/@username) + фильтры status/gender.
- **Фото-модерация:** `/admin/photos` — плотная таблица + slide-over drawer.

**Где код:**
- `src/components/admin-ops/` — OpsShell, примитивы (Button/Dialog/Field/StatusPill/
  Drawer/ReasonPicker), `case/` (студия), `photo/` (таблица+drawer), `clients/` (поиск+таблица).
- `src/lib/admin/` — лоадеры (`load-case`, `load-client`, `load-clients-search`,
  `load-photos`, `load-queue`, `load-reason-templates`), `passport-validation`,
  `case-state-machine`, `case-types`, `guard.ts` (auth+RBAC+F-119/F-120), `admin-tokens.ts`.
- `src/app/admin/` — страницы. `src/app/api/admin/cases/[id]/` —
  `claim`/`draft`/`decision`/`blocking-reject`.
- Планы спринтов: `docs/superpowers/plans/2026-06-27-admin-redesign-sprint-{1,2}-*.md`.

---

## 4. Что сделано за сессию (хронология)

1. **Survey** всей кодовой базы (10 агентов) + проверка багов по исходникам.
2. **Sprint 1** (был сделан в начале) — студия верификации + карточка клиента +
   5 таблиц/RPC. Коммиты до `e8fc27c`.
3. **H-3 фикс** (`7c045f0`) — студия approve роняла сама себя в `stale_case 409`.
4. **Sprint 2** (`568091b`/`7f81fec`/`6bbe174`) — Phase A фото-таблица+drawer,
   Phase B директория+поиск (RPC `admin_search_clients`), Phase C табы карточки.
5. **Adversarial-ревью** (8 агентов) → 6 находок (1 high F-120 + 5 med) → все
   закрыты (`a6c8ff5`). Затем `/admin/queue/mine` 500 (embed) — фикс `d1e4ee2`.
6. **Унификация дизайна** (`ae0d46c`) — перенёс ВСЕ legacy-экраны (дашборд/
   верификация/пользователи/жалобы/журнал/аналитика/логин) на OpsShell; пересобрал
   сайдбар. Проверено скриншотами всех 13 экранов (headless Chrome + CDP).
7. **Чистка** (`35da009`) — снёс мёртвые шеллы/компоненты, старый
   `/admin/verifications` → redirect на студию.
8. **Merge → main + deploy на прод** (`66559be`) — verified live (логин + все экраны 200).
9. **A / B1 / B2** (3 коммита, НЕ запушены — см. §1):
   - **A** (`f61496a`): «Пользователи» слиты в «Клиенты». Фильтры status/gender в
     директорию; `/admin/users` → redirect; убран из меню. Сломанный `UserActions`
     удалён (слал `{reason}` без F-119-`{action}` = баг **H-7**).
   - **B1** (`e09f526`): ProfileTab (анкета знакомств в карточке).
   - **B2** (`0ab5067`): blocking-reject (fake/minor/catfish) в студии через
     атомарный RPC `admin_blocking_reject_case` (применён на прод); старый
     `/api/admin/verifications/[id]/decision`+`doc`+`decision-validate` УДАЛЕНЫ
     → **баг H-1 выпилен из кодбазы**.
   - **C**: H-3 **проверен реальным браузером** (CDP-драйв, см. §7) — approve
     после автосейва приземляется на карточку клиента, БЕЗ `stale_case 409`.

---

## 5. DB-миграции (ВСЕ применены на прод вручную psql)

```
20260627100000_admin_design_foundation.sql   users.avatar_path
20260627100100_verification_cases.sql         verification_cases/case_events/case_notes (+ state enum)
20260627100200_user_identity.sql              user_identity (11 паспортных полей + provenance)
20260627100300_admin_reason_templates.sql     admin_reason_templates (ru/uz, seeded)
20260627100400_admin_case_rpcs.sql            admin_claim/save_draft/approve/reject_verification
20260627100500_pg_trgm_search.sql             pg_trgm + GIN/btree индексы для поиска
20260627110000_admin_search_clients.sql       RPC admin_search_clients (ранжированный jsonb id-массив)
20260627193000_outbox_match_events.sql        (мини-апп-сессия) tg_outbox event_type constraint
20260628000000_admin_blocking_reject_case.sql RPC admin_blocking_reject_case (атомарная обёртка)
```

Все таблицы/функции проверены на проде (приложение всю сессию гоняло против прод-БД).

---

## 6. Баги: найдено и сделано

- **H-1 (был ЖИВОЙ в проде):** старый approve верификации патчил
  `onboarding_step → profile_basic` вместе с `verification_status → approved`, но
  под Shadow Active юзер уже ушёл вперёд → `transition()` режет шаг → 409 →
  `approved` НИКОГДА не ставится → юзер не попадает в ленту. **ЗАКРЫТО:** новая
  студия (`admin_approve_verification`) НЕ трогает `onboarding_step`; старый
  verifications-API удалён целиком (B2). H-1 ушёл из кодбазы.
- **H-3:** студия approve саморонялась в `stale_case 409` (замороженный токен
  оптимистичной блокировки + автосейв черновика двигает `updated_at` триггером).
  **ЗАКРЫТО:** forward-only монотонный токен (epoch-сравнение) + in-flight
  seq-guard на автосейве. **Verified через CDP-браузер.**
- **H-4 / F-120:** новые маршруты + карточка клиента раскрывали паспортную PII вне
  очереди модератора. **ЗАКРЫТО:** директория+поиск = super-only;
  `/admin/clients/[id]` гейтится `checkInQueueOrSuperPage` (как `/admin/verifications/[id]`).
- **H-7:** кнопка бана в `/admin/users` была сломана (`{reason}` без F-119
  `{action}`). **ЗАКРЫТО:** удалена вместе со страницей (слита в Клиенты).
- 6 находок adversarial-ревью (RPC-error swallow, дубли age/avatar-signing,
  reason-templates split и др.) — закрыты в `a6c8ff5` + последующих.

---

## 7. Как проверять локально (рецепт)

**Локальный запуск (против прод-БД через public proxy):**
```bash
cd ~/Code/baxtlilar && pnpm build
set -a; . ./.env.access; set +a
export DATABASE_URL="$DATABASE_PUBLIC_URL" PGSSL=require \
  TELEGRAM_WEBHOOK_SECRET=localsmoke_dummy_secret_1234 \
  STORAGE_DIR="$(pwd)/.storage" PORT=4555 NODE_ENV=production
nohup pnpm start > /tmp/baxt-server.log 2>&1 &
```
Логин формой на `http://localhost:4555/admin/login` (`admin`/`$ADMIN_PASSWORD`).
CSRF: Origin браузера = localhost = совпадает с host → проходит. (curl: добавляй
`-H "Origin: http://localhost:4555"`, иначе `cross_origin`.)

**Форж bx_admin-куки (для curl/CDP без формы):**
`bx_admin = b64url(JSON{adminId,role:"superadmin",iat:Date.now()}) + "." + b64url(HMAC-SHA256(SESSION_SECRET, b64part))`.

**Скриншоты / драйв UI:** headless Chrome `--remote-debugging-port=9222` + node-скрипт
через встроенный `WebSocket` (CDP): `Network.setCookie` форж-куки → `Page.navigate`
→ `Runtime.evaluate` (React-инпуты через `Object.getOwnPropertyDescriptor(proto,'value').set`
+ dispatch input event; кнопки по `textContent`). Готовый драйв H-3:
`<scratchpad>/drive-h3.mjs` (этой сессии).

**Тестовые юзеры:** telegram_id в диапазоне `999000xxx`. Удаление мешает append-only
триггер на `case_events` → удалять в транзакции:
`BEGIN; ALTER TABLE case_events DISABLE TRIGGER USER; DELETE…; ENABLE; …; COMMIT;`
**FK-порядок:** `user_identity` (ref `source_case_id`) → ПЕРЕД `verification_cases`.

---

## 8. Главные гочи кодовой базы (НЕ наступать)

- **Нативный query-builder НЕ умеет** `.or` / `.ilike` / embed `table(cols)` /
  dotted-paths — кидает loud throw (раньше глоталось → пустые admin-страницы).
  Поиск с ILIKE/OR → в RPC. Связанные строки → отдельный `.in(...)` + сшивка в JS.
- **DB-error дисциплина:** все read-loader-запросы через `unwrapRows`/`unwrapOne`
  (`src/lib/db/unwrap.ts`) — иначе сбой БД = тихо пустая страница.
- **Миграции — вручную psql** по timestamp-порядку ПЕРЕД деплоем (Railway не
  запускает). Идемпотентны (`if not exists` / `on conflict`).
- **`case_events`/`case_notes` append-only** (триггер блокирует UPDATE/DELETE).
- **Next.js 16:** middleware → `proxy.ts`; `cookies()/headers()/params` async;
  `force-dynamic` страницы НЕ рендерятся в `next build` (compile ≠ render — гонять
  реальным запуском, curl на 200/307, не на 404/500).
- **F-119** (two-person ban) ≠ **blocking-reject** (одношаговый, в студии).
  F-119-бан в карточке клиента **отложен** (соло-супер не завершит two-person).
- Прод-логи: `pg_get_constraintdef`, статусы триггеров `pg_trigger.tgenabled`
  (`O`=вкл, `D`=выкл).

---

## 9. Открытые хвосты / что дальше

- [ ] **Запушить 3 коммита (A/B1/B2) → деплой** (ждут отмашки).
- [ ] **F-119-бан в карточке клиента** (нужен 2-й super-admin чтобы завершать).
      Оставлены backend-роуты `/api/admin/users/[id]/ban|unban|unblock-verification`.
- [ ] **moderator-scope карточки под Shadow Active** — `checkInQueueOrSuperPage`
      требует `lifecycle=onboarding`, а shadow-юзер уже `active` → карточка де-факто
      super-only для модераторов. Нужен Shadow-Active-aware scope.
- [ ] **UZ-локализация админки** (RU захардкожен).
- [ ] Дочистка: `/admin/cases/[id]` (старый verifications detail удалён, студия — канон).
- [ ] H-3 проверен CDP-driver'ом (happy path); ручной «человеческий» прокликов
      гонки overlapping-saves не делался (фикс по построению её исключает).

---

## 10. Память (если основной аккаунт на этой же машине)

Сводки лежат в `~/.claude/projects/-Users-fayzullohoja/memory/`:
- `project_baxtlilar_admin_redesign.md` — этот редизайн (самое свежее).
- `project_baxtlilar_v2_handoff.md` — V2-катовер мини-аппы.
- `project_bakhtlilar.md` — база проекта (частично устарела).
- `reference_baxtlilar_db_error_discipline.md` — DB-error класс.
