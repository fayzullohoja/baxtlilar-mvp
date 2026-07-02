The plan is written to disk (durable). Returning the full markdown as my output.

# MASTER P0 IMPLEMENTATION PLAN (ТЗ) — Baxtlilar Launch Prep

> Единый план подготовки к запуску на 10k пользователей. Собран из 9 воркстримов.
> Дата: 2026-07-02. Аудитория: учредитель + dev-команда.
> Источники: `docs/launch-readiness-2026-07-02.md`, `docs/audit-mvp-vs-spec-2026-07-01.md`, `docs/admin-gap-report-2026-07-01.md`, chat13.

---

## 1. Обзор

**9 воркстримов, ~90 задач.** Цель — довести Baxtlilar до состояния «готов к 10k»: закрыть все P0-блокеры безопасности, приватности, масштабирования БД, наблюдаемости и юр-согласий, включить revenue-with-day-1 (Plus гейтит чат), переработать админку и сделать матчинг устойчивым к разреженному пулу.

| # | Воркстрим | Задач | Что достигаем |
|---|-----------|-------|---------------|
| 1 | **verification** | 6 (VER-1..VER-6) | `verification_cases` — единственный источник истины очереди модерации; счётчик дашборда == очередь; заброшенные кейсы реально переоткрываются кроном |
| 2 | **appsec_p0** | 8 (VER-1..VER-8) | Закрыт pre-mutual PII-leak (APP-1): в клиентский payload попадает только то, что рендерит `ProgressiveProfile`; IDOR-гварды закреплены тестами + CI-guard на каждую /api route |
| 3 | **infra_security_p0** | 14 (SEC-1a..SEC-5) | Off-site шифрованный backup паспортов + проверенный restore; TOTP-2FA для admin/superadmin; глобальный rate-limit + body-cap + Cloudflare WAF; реальное расписание крона + алерты |
| 4 | **db_scale_p0** | 8 (DB-1..DB-8) | PgBouncer transaction-mode + sized pool; SSE-чат без DB-polling каждые 1.5с (LISTEN/NOTIFY); индексы горячих путей; корректный top-1 матч; EXPLAIN-harness на 10k seed |
| 5 | **observability_p0** | 9 (OBS-1..OBS-9) | Sentry (server/edge/client) с PII-скрабом; честный health-статус + внешний uptime-монитор; `/api/metrics`; Telegram-алерты на крон/outbox/credential-stuffing |
| 6 | **legal_consent_p0** | 9 (LC-1..LC-9) | Отдельные экраны согласий на чувствительные ПД + фото с полной proof-записью (status/source/action_id/category); отзыв согласия; админ-вью юр-статуса |
| 7 | **revenue_mvp** | 15 (REV-1..REV-15) | Plus (149 000 сум/мес) гейтит чат после mutual; Click + Payme webhooks (идемпотентные); лимиты по плану; крон-даунгрейд; тарифные экраны |
| 8 | **admin_rework** | 12 актив. + 2 deferred (AR-1..AR-14) | Полное покрытие V4-анкеты на клиент-карте; superadmin danger-zone (ban/delete/restart); Big Five таб; дизайн-полировка (Inter, radius-токены) |
| 9 | **business_matching_p0** | 9 (MATCH-1..5, FUNNEL-1..4) | `get_recommendations` деградирует по возрасту вместо пустого фида; North Star + воронка в `/admin/analytics` |

**Внешние зависимости уже сняты** (подтверждено):
- **Модераторы** уже существуют — воркстрим verification tooling-only, staffing не нужен.
- **Юрист** ревьюит копию согласий **параллельно** — код везёт `LAWYER_REVIEW` плейсхолдеры, чтобы swap не ломал контракт.
- **Мерчант-аккаунты** (Click/Payme) — интеграция ведётся параллельно; env опциональны, приложение бутается без них.
- **Бюджет** на платные сервисы (Sentry, uptime-монитор, Cloudflare, +$10-30/мес) учтён в launch-readiness.

---

## 2. Порядок исполнения (спринты)

Планирование учитывает cross-workstream зависимости и внешние лид-таймы. **Sprint 0** = быстрые тех-P0 без внешних зависимостей, запускаются немедленно. Юрист-копия и мерчант-интеграция стартуют в Sprint 0 «в фоне» (внешний лид-тайм) и материализуются к Sprint 2-3.

### Sprint 0 — Тех-P0 без внешних зависимостей (немедленно)

| Задача | Кратко | Объём | Зависимости |
|--------|--------|-------|-------------|
| VER-1 (verif) | DB-триггер auto-create verification_case на pending_review + partial unique index | S | — |
| appsec VER-1..VER-5 | ProgressiveProfileView + strip PII на 3 call-sites + payload-scrape тесты | S/S/S/S/M | цепочка |
| SEC-5 | Constant-time сравнение webhook/cron секретов | S | — |
| SEC-3a | Глобальный rate-limit (token-bucket) в middleware | L | — |
| DB-1 | PgBouncer transaction-mode + sized pool + relocate GUCs | M | — |
| DB-4 | Партиальные индексы (approved photos, unread messages) | S | — |
| DB-7 | 10k-row seed генератор | M | — |
| OBS-2 | Health-check: 503 при db=false | S | — |
| OBS-6 | Cron-роуты: честный не-200 + dead-letter учёт | S | — |
| OBS-1 + OBS-9 | Sentry wiring + CSP tunnel (идут вместе) | M/S | — |
| MATCH-1..5 | Degradation ladder + honest story (одним PR) | M/S/S/S/S | цепочка |
| FUNNEL-1..4 | Воронка + North Star RPC/UI (второй инженер) | M/S/S/S | цепочка |

**Запуск в фоне (внешний лид-тайм):** юрист получает бриф на копию согласий (LC для Sprint 2); мерчант-интеграция Click/Payme стартует (env-provisioning для Sprint 2-3).

### Sprint 1 — DB-масштаб, инфра-безопасность, verification замыкание

| Задача | Кратко | Объём | Зависимости |
|--------|--------|-------|-------------|
| VER-2 (verif) | Dashboard counter = open cases | S | VER-1 |
| VER-3 (verif) | Убрать app-level case-insert из selfie/fix | S | VER-1 |
| VER-4 (verif) | Case-based scope guard | M | VER-1 (open decision) |
| VER-5 (verif) | Реально запланировать housekeeping cron | S | — |
| DB-2 | NOTIFY-триггеры на chat_messages/chats | M | — |
| DB-3 | SSE rewrite: shared LISTEN + fan-out | L | DB-2, DB-1 |
| DB-5 | Sargable age filter (birth_date BETWEEN) + covering index | M | DB-4, DB-7 |
| DB-6 | Fix silent best-match loss + timeout-masked-as-empty | M | DB-5, DB-7 |
| DB-8 | EXPLAIN ANALYZE harness | S | DB-4/5/6, DB-7 |
| SEC-3b | Body-size cap на upload-роутах | M | SEC-3a |
| SEC-3c | Cloudflare/WAF перед Railway | M | — (инфра-конфиг) |
| SEC-2a | Миграция totp_secret + enrollment-поля | S | — |
| SEC-1a | Ночной шифрованный off-site backup /data → R2/S3 | M | — |
| SEC-1b | Railway Postgres auto-backup + подтвердить persistent volume | S | — |
| SEC-4a | Надёжный планировщик housekeeping+backup крона | S | — |
| SEC-4b | Алерты: сбой крона, застой outbox, mass admin-throttle | M | SEC-4a |
| OBS-5 | 5xx rolling-window counter | M | OBS-1 |
| OBS-4 | Secret-protected /api/metrics | M | OBS-6 |
| OBS-3 | Внешний uptime-монитор на /api/health | S | OBS-2 |
| OBS-7 | Алерт на outbox backlog age (dead-man's-switch) | S | OBS-4, OBS-6 |
| OBS-8 | Алерт на не-200 крона + admin mass-throttle | S | OBS-4 |
| appsec VER-6/7/8 | IDOR-тесты + CI-guard + stream-route parity | M/M/S | — |
| VER-6 (verif) | Инвариант + reclaim harness | S | VER-1/2/3/5 |

### Sprint 2 — Legal, TOTP-enforcement, revenue-фундамент

| Задача | Кратко | Объём | Зависимости |
|--------|--------|-------|-------------|
| LC-1 | Миграция consents: status/source/action_id/category + backfill | M | — |
| LC-2 | Server helper recordConsentMiniApp() | M | LC-1 |
| LC-3 | State-machine: 2 новых consent-step | M | — |
| LC-6 | Legal copy blocks + category constant (LAWYER_REVIEW от юриста) | S | юрист |
| LC-4 | Sensitive-PD consent screen + endpoint | L | LC-1/2/3/6 |
| LC-5 | Photo consent screen + endpoint | L | LC-1/2/3/6 |
| LC-7 | Consent withdrawal | M | LC-1/2 |
| LC-8 | Admin legal/consent view | M | LC-1 |
| LC-9 | Restart wipes consents + regression | S | LC-1 |
| SEC-2b | TOTP enrollment flow | L | SEC-2a |
| SEC-2c | Двухшаговый admin-login + enforcement (мержить последним) | L | SEC-2b (+ручной enrollment на проде) |
| REV-1 | DB-схема: base_plan, subscriptions, chat_status, payment_sessions, analytics_events | M | — |
| REV-2 | Grant/downgrade/limit RPCs | L | REV-1 |
| REV-6 | Env Click/Payme (optional) | S | — |
| REV-13 | Analytics events + track helper | S | REV-1 |
| SEC-1c | Реальный restore-тест (БД + volume) | M | SEC-1a, SEC-1b |

### Sprint 3 — Revenue gating + payments + admin-rework

| Задача | Кратко | Объём | Зависимости |
|--------|--------|-------|-------------|
| REV-3 | Lock chat at mutual когда нет Plus (process_interest) | L | REV-1, REV-2 |
| REV-4 | Enforce chat_status в message API (loadChatRow) | M | REV-1, REV-3 |
| REV-5 | Chat detail page paywall | M | REV-1, REV-3, REV-10 |
| REV-7 | payment_sessions + create-session API | M | REV-1, REV-6, REV-13 |
| REV-8 | Click webhook (Prepare/Complete, idempotent) | L | REV-2, REV-7, REV-13 |
| REV-9 | Payme webhook (JSON-RPC, idempotent) | L | REV-2, REV-7, REV-13 |
| REV-10 | Tariffs screen + mutual-interest paywall | L | REV-7 |
| REV-11 | Pro screen (data-driven price) | M | REV-7, REV-10 |
| REV-12 | Plan limits enforcement + limit screens | L | REV-2, REV-3, REV-10, REV-13 |
| REV-14 | Cron sweeps: expiry downgrade + 7d lock expiry | M | REV-2, REV-3 |
| REV-15 | Admin read-only subscription view | M | REV-1, REV-2 |
| AR-6 | RPC: hard_delete_user + restart_onboarding | M | — |
| AR-7 | Danger-zone API routes | M | AR-6 |
| AR-8 | Danger-zone UI (superadmin-only) | L | AR-7 |
| AR-1..AR-5 | ProfileTab полное покрытие V4-анкеты | S/M×4 | AR-1 keystone |
| AR-9 | Big Five таб | M | — |
| AR-10/11/12 | Дизайн-полировка (Inter, radius, bg/font) | S/M/S | — |

---

## 3. По воркстримам

### WS-1: verification — единый источник истины очереди модерации

**Цель:** `verification_cases` — единственный источник истины: каждый путь в `verification_status='pending_review'` гарантирует ровно один открытый кейс; счётчик дашборда == очередь; scope-guard case-based; заброшенные кейсы реально переоткрываются кроном.

**VER-1 — DB-триггер auto-create verification_case [S]**
- Файл: `supabase/migrations/20260702100000_verification_case_autocreate_trigger.sql`
- Что: `AFTER INSERT OR UPDATE OF verification_status ON users FOR EACH ROW WHEN (new.verification_status='pending_review')` → идемпотентный insert case (`state='new'`) если `NOT EXISTS(select 1 from verification_cases where user_id=new.id and state<>'closed')`. SECURITY DEFINER, `set search_path=public,pg_temp`. Закрывает VF-1/VF-2/VF-5 разом (`transition_user` 20260619500001:202 и `admin_unblock_verification` 20260620920000:145 — plain UPDATE; selfie/fix идут через transition_user).
- DB: `CREATE FUNCTION verification_case_autocreate()` + trigger. **Плюс partial unique index** `CREATE UNIQUE INDEX verification_cases_one_open_per_user ON verification_cases(user_id) WHERE state<>'closed'` в той же миграции → race-safe (триггер глотает unique_violation).
- Приёмка: 5 сценариев psql — (1) UPDATE→pending_review без открытого кейса создаёт ровно 1 case; (2) повтор — 0 новых; (3) reject(needs_changes) закрывает case, затем fix→pending_review создаёт новый; (4) approve→verified / reject→rejected не создают case; (5) любой UPDATE не в pending_review — no-op.

**VER-2 — Dashboard counter = open cases [S]** (dep: VER-1)
- Файл: `src/app/admin/page.tsx` (строки 28-31)
- Что: заменить count `users WHERE verification_status='pending_review'` на `sb.from('verification_cases').select('*',{count:'exact',head:true}).neq('state','closed')`. Source-identical к `load-queue.ts:96/:110`.
- Приёмка: dashboard 'Заявки на проверке' == COUNT(cases state<>'closed'); approve декрементит.

**VER-3 — Убрать app-level case-insert [S]** (dep: VER-1)
- Файлы: `src/app/api/onboarding/selfie/route.ts` (удалить строки 67-85), `src/app/api/onboarding/fix/route.ts` (комментарий, кода нет — не добавлять block, это был VF-1 root cause)
- **Порядок деплоя:** VER-3 только ПОСЛЕ того как VER-1 live (атомарный деплой миграции на boot безопасен).
- Приёмка: selfie не трогает verification_cases; e2e selfie→1 case; needs_changes→fix→1 новый case, без app-insert.

**VER-4 — Case-based scope guard [M]** (dep: VER-1, **open decision**)
- Файл: `src/lib/admin/guard.ts` (`requireInQueueOrSuper` :328, `checkInQueueOrSuperPage` :370)
- Что: заменить `verification_status='pending_review' AND lifecycle_state='onboarding'` на `verification_cases WHERE user_id=$1 AND state<>'closed' LIMIT 1`. Оба call-site изменить идентично. Superadmin bypass без изменений.
- Приёмка: модератор открывает user iff есть open case; verified user → 403 + `admin_scope_violations` row.

**VER-5 — Запланировать housekeeping cron [S]**
- Файлы: `.github/workflows/cron-housekeeping.yml`, `railway.json`
- Что: RPC `admin_sla_reclaim_stale_cases` (20260630010000) сейчас ничем не планируется. **Рекомендация: Railway scheduled job** POST `/api/cron/housekeeping` с `X-Cron-Secret`, hourly/6h + dead-man's-switch alert.
- Приёмка: stale case (assigned, updated_at >168h) авто-возврат в `state='new'` без ручного вызова; без секрета 401, с ним 200 + `admin_sla_reclaim_stale_cases ok:true`.

**VER-6 — Invariant + reclaim harness [S]** (dep: VER-1/2/3/5)
- Файл: `scripts/verify/verification-invariant.sql`
- Что: репитабельный psql-скрипт: 3 pending_review пути → 1 open case; count-identity; stale reclaim; идемпотентность. BEGIN/ROLLBACK.

---

### WS-2: appsec_p0 — pre-mutual PII leak + IDOR pin

**Цель:** ни один exact/sensitive PII кандидата не сериализуется в клиентский payload до mutual; IDOR-гварды закреплены тестами + CI-guard (RLS OFF — код единственная граница).

**VER-1 — ProgressiveProfileView type + server mapper [S]**
- Файлы: `src/lib/v2/progressive-view.ts`, `src/components/v2/ProgressiveProfile.tsx`, `src/lib/v2/match-story.ts`
- Что: narrow type `ProgressiveProfileView` только с рендеримыми полями: `first_name` (=firstWord(display_name), surname никогда не шлётся), city, education, religion, top_life_values, bio, `traits: string[]`. Mapper `toProgressiveView(p: ProfileForMatch)` — OMIT birth_date, marital_status, has_children, future_children_plan, partner_age_min/max, geo_preference, raw vector. `personalityTraits` переносится server-side (byte-identical: >60/<40, slice(0,3)).
- Приёмка: JSON.stringify view не содержит запрещённых ключей и raw O/C/E/A/ES.

**VER-2 — Convert ProgressiveProfile client component [S]** (dep: VER-1)
- Файл: `src/components/v2/ProgressiveProfile.tsx` — Props `{profile: ProgressiveProfileView}`; `firstWord`→`profile.first_name`, `personalityTraits(vector)`→`profile.traits`. Три call-site мигрировать в одном PR.

**VER-3 — /main call site [S]** (dep: VER-1, VER-2)
- Файл: `src/app/[locale]/main/page.tsx` — обернуть `match.candidate.profile` в `toProgressiveView(...)`. `match.story` безопасен (bucketed phrases). `candidateFirstName` держать server-side.

**VER-4 — /v2/profile/[id] pre-mutual (первичный APP-1 leak) [S]** (dep: VER-1, VER-2)
- Файл: `src/app/[locale]/v2/profile/[id]/page.tsx` (строки 125-140) — заменить `progressiveData` литерал на `toProgressiveView(...)`. Post-mutual `RevealedProfile` (isMutual===true) без изменений. **Не трогать isMutual/areBlocked/lifecycle гварды.**

**VER-5 — /v2/anketa/preview + payload-scrape тесты [M]** (dep: VER-1..4)
- Файлы: `src/app/[locale]/v2/anketa/preview/page.tsx`, `src/lib/v2/progressive-view.test.ts`, `e2e/premutual-payload-scrape.spec.ts`
- Приёмка: fail-closed — вернуть forbidden field → тест RED; seeded birth_date отсутствует в 3 pre-mutual payload, city присутствует.

**VER-6 — IDOR/ownership regression tests [M]** (independent)
- Файлы: `src/app/api/chats/[id]/__tests__/ownership.test.ts`, `.../requests/[id]/__tests__/decision-ownership.test.ts`, `.../interest/__tests__/ownership.test.ts`
- Что: (a) user C → chat routes 404; (b) requests decision 403 (receiver accept/decline, sender withdraw); (c) interest receiver_id===self → 400, sender_id из сессии (body spoof игнорируется). Ownership УЖЕ enforced — тесты пинят.

**VER-7 — CI guard: каждая /api route импортирует guard [M]** (independent)
- Файлы: `scripts/check-api-guards.ts`, `package.json`
- Что: скан `src/app/api/**/route.ts` — fail если нет `requirePermissionForRequest`/`requireAllPermissionsForRequest`/`loadActiveUserApi` или allowlist-записи (health, cron с секретом, telegram webhook). Seed allowlist из текущего дерева.

**VER-8 — Stream route guard parity [S]** (independent, **open decision**)
- Файл: `src/app/api/chats/[id]/stream/route.ts` — добавить `requirePermissionForRequest('open_chat')` для defense-in-depth ИЛИ задокументировать divergence. `ROLE_PERMISSIONS.paused` включает open_chat — не сломать paused-стримы.

---

### WS-3: infra_security_p0 — backup / TOTP / rate-limit / cron

**Цель:** off-site шифрованный backup паспортов + проведённый restore-тест; TOTP-2FA обязателен для superadmin; глобальный rate-limit + body-cap + Cloudflare WAF; реальное расписание крона + алерты.

**SEC-5 — Constant-time сравнение секретов [S]**
- Файлы: `src/app/api/telegram/webhook/route.ts`, `.../cron/tg-outbox/route.ts`, `.../cron/housekeeping/route.ts`
- Что: заменить `!==` на `safeEqual` (`src/lib/crypto/safe-equal.ts`). Привести `got` к строке до вызова (`Buffer.from(null)` бросает). Fail-closed сохранить.

**SEC-3a — Глобальный rate-limit (token-bucket) [L]**
- Файлы: `src/proxy.ts`, `src/lib/http/rate-limit.ts`, `src/lib/telegram/bot/handlers.ts`
- Что: token-bucket по `trustedIp(req)` (аноним) + `bx_session`-хэш (авториз.); жёсткие вёдра для `/api/auth/bootstrap`. Per-user кулдаун на `/start`. In-memory Map + Postgres-fallback для bootstrap. **ВЕРИФИЦИРОВАТЬ: middleware in-process (не edge)**, иначе in-memory бесполезен.
- Приёмка: N+1 запрос → 429 + Retry-After; чат-поллинг 1.5с не ловит 429; health/webhook/cron/storage исключены.
- Риск: chat SSE поллит каждые 1.5с — калибровать по реальному темпу; CGNAT TG WebView → IP-лимит широкий, точечные на session-ключ.

**SEC-3b — Body-size cap на upload-роутах [M]** (dep: SEC-3a)
- Файлы: `src/proxy.ts`, `.../onboarding/selfie/route.ts`, `.../document/route.ts`, `.../profile/photo/route.ts`, `src/lib/uploads/storage.ts`
- Что: middleware отвергает `Content-Length > MAX` (12MB) до route; вторая проверка буфера в роутах (413) до записи на volume. `MAX_UPLOAD_BYTES` в общий модуль.

**SEC-3c — Cloudflare/WAF перед Railway [M]** (config)
- Файл: `src/lib/http/ip.ts`
- Что: DNS-проксирование (оранжевое облако), managed WAF, edge rate-limit floor. `trustedIp()` приоритезирует `CF-Connecting-IP`. Проверить: SSE `/api/chats/[id]/stream` не буферизуется CF (bypass/cache-off); webhook не блокировать.

**SEC-2a — Миграция totp_secret [S]**
- Файл: `supabase/migrations/20260702100000_admin_totp.sql`
- DB: `ALTER TABLE admin_users ADD COLUMN totp_secret text, totp_enrolled_at timestamptz`. Опц. `admin_totp_recovery_codes(admin_id, code_hash, used_at)`. null=не enrolled (login-совместимость). Рассмотреть шифрование секрета env-ключом.

**SEC-2b — TOTP enrollment flow [L]** (dep: SEC-2a)
- Файлы: `src/lib/admin/totp.ts`, `.../api/admin/totp/enroll/route.ts`, `.../enroll/verify/route.ts`, `src/app/admin/(...)/totp-setup/page.tsx`
- Что: RFC 6238 hand-roll через `node:crypto` (HMAC-SHA1, 30s, 6 цифр, ±1 окно), base32 encode/decode (RFC 4648, покрыть test-vectors). `POST /enroll` → секрет pending + otpauth:// (QR на клиенте); `POST /enroll/verify` → активация. Audit `totp_enroll`.

**SEC-2c — Двухшаговый admin-login + enforcement [L]** (dep: SEC-2b)
- Файлы: `.../api/admin/login/route.ts`, `.../login/totp/route.ts`, `src/lib/admin/session.ts`, `src/proxy.ts`
- Что: пароль-ОК + enrolled → `pending_totp` (подписанная короткоживущая cookie, <5мин) + `{totp_required:true}`; `POST /login/totp` → полная сессия. **Superadmin без enrollment → редирект на setup.** Троттлинг на totp-шаг (5/15мин по adminId). **Enforcement НЕ включать до ручного enrollment живого superadmin (self-lockout).** Мержить последним.

**SEC-1a — Ночной шифрованный off-site backup /data [M]**
- Файлы: `.../api/cron/backup/route.ts`, `src/lib/backup/volume-backup.ts`, `src/lib/env.ts`
- Что: endpoint под `X-Cron-Secret` (только web-инстанс видит single-attach `/data`): tar STORAGE_DIR → age/gpg symmetric (`BACKUP_ENCRYPTION_KEY`) → upload R2/S3 с датой + ротация. **Стримить tar в upload (multipart), не буферизовать** (30-90GB на масштабе). Ключ + оффлайн-копия задокументированы.

**SEC-1b — Railway Postgres auto-backup + persistent volume [S]** (ops)
- Файл: `docs/launch-readiness-2026-07-02.md`
- Что: подтвердить `/data` = persistent Volume (не эфемерная FS); включить managed snapshots; записать RPO/RTO. **Если /data эфемерный — hidden critical, эскалировать.**

**SEC-1c — Реальный restore-тест [M]** (dep: SEC-1a, SEC-1b)
- Файлы: `docs/launch-readiness-2026-07-02.md`, `docs/restore-runbook.md`
- Что: ПРОВЕСТИ: (a) restore Postgres-снапшота в отдельную БД, проверить схему+данные; (b) скачать volume-backup из R2/S3, расшифровать, распаковать, sha256 выборки == оригинал, картинки открываются. Приёмка = restore проведён, не «скрипт есть».

**SEC-4a — Надёжный планировщик крона [S]**
- Файлы: `railway.json`, `.github/workflows/cron-tg-outbox.yml`, `docs/restore-runbook.md`
- Что: Railway scheduled job POST `/api/cron/housekeeping` hourly + backup (SEC-1a) daily. GH Actions free-tier только fallback для outbox.

**SEC-4b — Алерты крон/outbox/mass-throttle [M]** (dep: SEC-4a)
- Файлы: `src/lib/ops/alert.ts`, `.../cron/housekeeping/route.ts`, `.../cron/tg-outbox/route.ts`, `src/lib/admin/throttle.ts`, `src/lib/env.ts`, `docs/oncall-runbook.md`
- Что: `sendOpsAlert` → Telegram ops-chat (`OPS_ALERT_CHAT_ID`). Триггеры: (1) cron ok:false/5xx/не вызван; (2) `tg_outbox` depth высок ИЛИ `attempts>=5` (застряли навсегда); (3) всплеск admin-login-throttle. Дедуп + cooldown (try/catch best-effort).

---

### WS-4: db_scale_p0 — pooling / SSE / индексы / корректность матча

**Цель:** система переживает launch-scale concurrency на single-attach Postgres без исчерпания коннектов.

**Cross-cutting (критично):** DB-1's PgBouncer transaction-mode форсит: (a) DB-3 listener использует DIRECT (non-pooled, 5432) connection; (b) startup GUCs уходят с connection-`options` на `ALTER ROLE`/per-txn SET (transaction-mode дропает их).

**DB-1 — PgBouncer transaction-mode + sized pool + relocate GUCs [M]**
- Файлы: `src/lib/db/pool.ts`, `src/lib/env.ts`, `.env.local.example`, `supabase/migrations/20260702000000_role_gucs.sql`, `CLAUDE.md`, `README.md`
- Что: PgBouncer transaction-mode; `DATABASE_URL` (pooled 6543) + `DATABASE_DIRECT_URL` (direct 5432 для listener+миграций). Explicit `max` из `PG_POOL_MAX` (дефолт 15). **УБРАТЬ** `-c statement_timeout=... -c idle_in_transaction_session_timeout=... -c application_name=...` из pg `options`; применить через `ALTER ROLE <app_user> SET statement_timeout='10000'` (миграция).
- Приёмка: N concurrent requests не открывают >PG_POOL_MAX backend-коннектов (`pg_stat_activity`); `SHOW statement_timeout` = 10s на pooled; slow query убит на 10s; DATABASE_DIRECT_URL обходит pooler.
- Риск: transaction-mode дропает session-фичи; верифицировать что нет server-side prepared statements across pooled txns.

**DB-2 — Commit-atomic NOTIFY на chat_messages/chats [M]**
- Файл: `supabase/migrations/20260702010000_chat_notify_triggers.sql`
- Что: `AFTER INSERT ON chat_messages` + `AFTER UPDATE OF read_at` + `AFTER UPDATE OF typing_a_until/typing_b_until ON chats` → `pg_notify` на канал chat_events, компактный JSON (`kind, chat_id`, только IDs, <8000 байт). **statement-level trigger** на bulk read_at (один NOTIFY на /read вызов).

**DB-3 — SSE rewrite: shared LISTEN + fan-out [L]** (dep: DB-2, DB-1)
- Файлы: `src/app/api/chats/[id]/stream/route.ts`, `src/lib/chat/notify-listener.ts`, `src/lib/db/pool.ts`
- Что: убрать 1.5с polling loop. ОДИН process-wide `pg Client` на `DATABASE_DIRECT_URL` (не pooled, не из pool), `LISTEN chat_events` один раз, fan-out через EventEmitter по chat_id. На NOTIFY → `getLiveState(id, user.id, chat, cursor)` (только delta) → SSE frame. Heartbeat + MAX_MS. Auto-reconnect (re-LISTEN). Client fallback polling в `ChatRoom.tsx` без изменений.
- Приёмка: K стримов, 0 активности → ровно 1 Postgres backend на инстанс (независимо от K); событие доходит <1s без per-tick query.

**DB-4 — Партиальные индексы hot-path [S]**
- Файл: `supabase/migrations/20260702020000_scale_indexes.sql`
- DB: (1) `CREATE INDEX profile_photos_approved_idx ON profile_photos (user_id, is_main DESC, ord) WHERE status='approved'`; (2) `CREATE INDEX chat_messages_unread_idx ON chat_messages (chat_id, sender_id) WHERE read_at IS NULL`. **CONCURRENTLY** если на живой БД (не в concat-транзакции — standalone миграция).

**DB-5 — Sargable age filter + covering index [M]** (dep: DB-4, DB-7)
- Файлы: `supabase/migrations/20260702030000_recommendations_sargable.sql`, `src/lib/matching/recommend.ts`
- Что: переписать `date_part('year', age(cp.birth_date))::int BETWEEN ...` (20260630000000:43-44) в `birth_date BETWEEN (current_date - (max+1)y + 1d) AND (current_date - min y)`. Индекс `user_profiles_reco_idx ON user_profiles (looking_for_gender, gender, status, birth_date) WHERE status='published'`. **CAUTION: bound inversion (выше max → раньше birth_date), birthday-edge vs age() truncation.**
- Приёмка: **set-equality** на 10k seed (те же user_ids) для батареи viewers на age-edges; Index Scan, не Seq Scan.

**DB-6 — Fix silent best-match loss + timeout-masked-as-empty [M]** (dep: DB-5, DB-7)
- Файлы: `src/lib/matching/recommend.ts`, `src/lib/v2/match-of-the-day.ts`, `supabase/migrations/20260702030000_recommendations_sargable.sql`
- Что: (1) DBS-04: score в JS, `LIMIT p_limit`(100) без ORDER BY роняет true top-1 → **option (a)** поднять/убрать LIMIT, скорить всех viable в JS (проверить на seed что viable-set bounded, low hundreds); если blow past — escalate к option (b) port score в SQL. (2) DBS-08: `if (error || !rows) return []` маскирует timeout как empty → throw/typed error, match-of-the-day показывает retry vs genuine-empty.

**DB-7 — 10k-row seed [M]**
- Файл: `scripts/seed-10k.mjs`
- Что: ~10k users (active/approved), user_profiles (published, valid gender pairs, birth_date по age-windows, Tashkent-weighted, top_life_values, partner_age_min/max), profile_photos (>=1 approved), quiz_results vectors, chats+chat_messages (unread), match_requests/match_views/blocks. Все FK/enum/check clean, идемпотентно. **Некоторые viewers с >100 matches** (иначе DB-5/6 acceptance vacuous).

**DB-8 — EXPLAIN ANALYZE harness [S]** (dep: DB-4/5/6, DB-7)
- Файлы: `scripts/explain-harness.mjs`, `docs/db-scale-explain-baseline.md`
- Что: `EXPLAIN (ANALYZE, BUFFERS)` на get_recommendations, getLiveState read_through, unread-count, /read. Assert Index Scan на 3 индексах, NO Seq Scan на hot-path. `get_recommendations` p95 <50ms. **ANALYZE seed сначала** (иначе false failures).

---

### WS-5: observability_p0 — Sentry / health / metrics / alerts

**Цель:** unhandled-ошибки автоматически в дашборд с PII-скрабом; внешний uptime-монитор; `/api/metrics`; Telegram-алерты.

**OBS-2 — Health честный HTTP-статус [S]**
- Файл: `src/app/api/health/route.ts:20`
- Что: 503 когда `db===false`, 200 когда `db===true`. Состав полей не менять (anti-recon F-117).
- Риск: `railway.json healthcheckTimeout=120 + restartPolicyMaxRetries=5` — 503 из-за temp DB triggers рестарт; согласовать с инфра.

**OBS-6 — Cron-роуты честный не-200 + dead-letter [S]**
- Файлы: `src/app/api/cron/tg-outbox/route.ts`, `src/lib/v2/tg-outbox-worker.ts`
- Что: если `stats.failed>0 && stats.sent===0` → 502/207. Добавить `dead_letter_count` (COUNT WHERE attempts>=5 AND sent_at IS NULL — эти скипаются `processOutboxBatch` навсегда). Единичный юзер без telegram_id не должен ложно триггерить.

**OBS-1 — Sentry server+edge+client [M]**
- Файлы: `instrumentation.ts`, `instrumentation-client.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`, `next.config.ts`, `package.json`, `src/lib/env.ts`, `.env.local.example`
- Что: `@sentry/nextjs` (^16, совместим next@16.2.6). `onRequestError` хук (обязателен Next 16 App Router). `withSentryConfig(withNextIntl(...))`. **КРИТИЧНО PII:** `sendDefaultPii:false` + `beforeSend` чистит cookie (bx_session, bx_admin), X-Cron-Secret, X-Telegram-Bot-Api-Secret-Token, тела `/api/onboarding/*`, `/api/admin/clients/*`, `/api/storage/*`.
- Приёмка: 3 ошибки (route handler, Server Component, client) в дашборде <1мин, без секретов.

**OBS-9 — CSP tunnel для Sentry [S]** (dep: OBS-1)
- Файлы: `next.config.ts`, `instrumentation-client.ts`
- Что: `connect-src 'self'` блокирует `*.ingest.sentry.io` → включить `tunnel: '/monitoring'` (same-origin). Не расширять connect-src. `tracesSampleRate <=0.1`.

**OBS-4 — Secret-protected /api/metrics [M]** (dep: OBS-6)
- Файлы: `src/app/api/metrics/route.ts`, `src/lib/env.ts`
- Что: под X-Cron-Secret/METRICS_SECRET. JSON: pg-pool (total/idle/waiting vs PG_POOL_MAX), tg_outbox (depth, oldest_age_seconds, dead_letter_count), `verification_queue_depth` (COUNT cases state<>'closed'), `five_xx_rate_5min`.

**OBS-5 — 5xx rolling-window counter [M]** (dep: OBS-1)
- Файлы: `src/proxy.ts`, `instrumentation.ts`, `src/lib/observability/five-xx-counter.ts`
- Что: in-memory (single-instance) rolling 5-мин bucket из `onRequestError` + ручной инкремент явных `NextResponse.json(...,{status:5xx})` в proxy. Теряется при рестарте — задокументировать.

**OBS-3 — Внешний uptime-монитор [S]** (dep: OBS-2)
- Файлы: external (UptimeRobot/Better Uptime/Checkly), `docs/runbook-observability.md`
- Что: GET `/api/health`, 1-5 мин, алерт на !=200 (детектит DB-outage через OBS-2) → Telegram-канал.

**OBS-7 — Алерт на outbox backlog age (dead-man's-switch) [S]** (dep: OBS-4, OBS-6)
- Файлы: `.github/workflows/cron-tg-outbox.yml`, `.../cron-housekeeping.yml`, external healthchecks.io
- Что: после дрейна дёрнуть `/api/metrics`, `outbox_oldest_age_seconds > 900` → Telegram. **Вариант B (healthchecks.io) как истинно независимый** (пинг после успеха; нет пинга → внешний алерт).

**OBS-8 — Алерт на не-200 крона + admin mass-throttle [S]** (dep: OBS-4)
- Файлы: `.github/workflows/cron-tg-outbox.yml`, `src/app/api/metrics/route.ts`, `src/lib/admin/throttle.ts`
- Что: STATUS!=200 → Telegram (curl sendMessage). `admin_login_failures_5min` в metrics, алерт >20/5мин (credential-stuffing). Прочитать throttle.ts (in-memory vs DB-backed).

---

### WS-6: legal_consent_p0 — согласия на чувствительные ПД + фото

**Цель:** ни одни sensitive/photo данные не собираются без явного отдельно-записанного согласия; каждая запись несёт status/source/action_id/category; отзыв + админ-вью. Копия — `LAWYER_REVIEW` (юрист параллельно). Миграции `20260702xxxxxx` (после `20260701010000_anketa_v4_enum_values.sql`).

**LC-1 — Миграция consents enrich [M]**
- Файл: `supabase/migrations/20260702000000_consents_status_source_action.sql`
- DB: `CREATE TYPE consent_status ('active','withdrawn','outdated')`; `ALTER TABLE consents ADD consent_status default 'active', source, action_id (default gen_random_uuid()::text, per-row unique в backfill), categories text[], withdrawn_at, withdrawn_reason, telegram_id bigint`. Backfill legacy → active/tg_bot. Index `(user_id, consent_status)`. Не NOT NULL на categories.

**LC-2 — recordConsentMiniApp() [M]** (dep: LC-1)
- Файл: `src/lib/legal/record-consent.ts`
- Что: `{userId, telegramId, types, categories?, text, lang, ip, userAgent, source}` → action_id. Пишет active/mini_app, real ip/UA, `consent_text_sha256 = sha256(text + '::' + LEGAL_VERSION)` (формула == bot). Идемпотентный upsert `(user_id,consent_type,consent_version)`.

**LC-3 — State-machine 2 consent-step [M]**
- Файлы: `src/lib/state-machine/types.ts`, `router.ts`, `supabase/migrations/20260702000100_consent_gate_steps.sql`
- Что: OnboardingStep `profile_consent_sensitive`, `profile_consent_photos`. Re-route `family_model → consent_sensitive → finance`; `partner_extended/privacy → consent_photos → photos`. Back-edges. `ALTER TYPE onboarding_step ADD VALUE IF NOT EXISTS`. **Каждый step в ОБА exhaustive Record (ALLOWED_TRANSITIONS + ONBOARDING_PATHS) иначе TS build fail.**

**LC-4 — Sensitive-PD consent screen [L]** (dep: LC-1/2/3/6)
- Файлы: `src/app/[locale]/v2/anketa/consent-sensitive/page.tsx`, `src/components/v2/AnketaConsentSensitiveForm.tsx`, `.../api/onboarding/profile/consent-sensitive/route.ts`, `src/content/legal.ts`, `messages/ru.json`, `messages/uz.json`
- Что: `requireUserAtStep(...,'profile_consent_sensitive')`, 2 required checkbox + список категорий (finance/lifestyle/health), Continue disabled пока не оба. POST → `recordConsentMiniApp({types:['sensitive'],categories})` → transition → finance. Non-skippable через requireUserAtStep + ALLOWED_TRANSITIONS.

**LC-5 — Photo consent screen [L]** (dep: LC-1/2/3/6)
- Файлы: `.../v2/anketa/consent-photos/page.tsx`, `AnketaConsentPhotosForm.tsx`, `.../api/onboarding/profile/consent-photos/route.ts`, `messages/*.json`
- Что: 2 checkbox (обработка изображений + права на third-party/family фото — LEGAL-010). POST → `recordConsentMiniApp({types:['photo']})` → transition → photos. **Gate ДО `/api/onboarding/profile/photo`** (409 если фото до согласия).

**LC-6 — Legal content blocks + category constant [S]** (юрист)
- Файлы: `src/content/legal.ts`, `messages/*.json`
- Что: `SENSITIVE_CATEGORIES` (finance/lifestyle_habits/health, ru/uz), `CONSENT_SENSITIVE`, `CONSENT_PHOTO` (title+body+2 checkbox, ru/uz, LAWYER_REVIEW). Bump LEGAL_VERSION только если copy материально меняется.

**LC-7 — Consent withdrawal [M]** (dep: LC-1/2)
- Файлы: `.../api/account/route.ts`, `.../v2/settings/page.tsx`, `SettingsActions.tsx`, `messages/*.json`
- Что: `POST /api/account {action:'withdraw_consent', consent_type}` → `UPDATE consents SET consent_status='withdrawn', withdrawn_at WHERE ...active`. Не cascade-delete (proof сохранить). Settings рендерит consents со статусом + Withdraw для sensitive/photo. (a) status-flip сейчас; (b) purge — follow-up retention-matrix.

**LC-8 — Admin legal/consent view [M]** (dep: LC-1)
- Файлы: `src/app/admin/clients/[id]/LegalTab.tsx`, `page.tsx`, `src/lib/admin/load-legal-status.ts`
- Что: Legal-таб (паттерн IdentityTab/ModerationTab), матрица статусов per consent_type (active/withdrawn/outdated/missing). Read-only.

**LC-9 — Restart wipes consents + regression [S]** (dep: LC-1)
- Файлы: `supabase/migrations/20260702000200_restart_wipes_consents.sql`, `.../api/admin/users/[id]/restart-onboarding/route.ts`
- Что: `admin_restart_onboarding(...,p_wipe_consents)` → `DELETE FROM consents` при wipe=true (mind append-only case triggers §98). **Координировать с AR-6 (тот же RPC) — не создавать дубль.** Regression: после restart 0 consents, re-consent форсится.

---

### WS-7: revenue_mvp — Plus гейтит чат

**Цель:** revenue-from-day-1. Plus (149 000 сум/мес) открывает чат после mutual. Click + Payme идемпотентны, атомарно grant Plus + unlock. Лимиты по плану. Источник истины: `subscriptions`; `users.base_plan + plan_expires_at` денормализованы.

**REV-1 — DB-схема [M]**
- Файл: `supabase/migrations/20260703000000_revenue_mvp_schema.sql`
- DB: enum `plan_tier ('free','plus','pro')`; `users.base_plan default 'free', plan_expires_at`; `subscriptions` (user_id, plan, status, provider, started/expires_at, source_screen); `chats.status default 'open' check ('open','locked_requires_plus','expired') + locked_at + lock_expires_at`; `payment_sessions` (plan, duration, amount, currency, provider, kind default 'self', status default 'pending', provider_txn_id, chat_id, + **unique (provider, provider_txn_id) идемпотентность**); `analytics_events`. **chats.status default 'open' — существующие пары работают, lock только на новые.**

**REV-2 — Grant/downgrade/limit RPCs [L]** (dep: REV-1)
- Файлы: `supabase/migrations/20260703001000_revenue_rpcs.sql`, `src/lib/db/query-builder.ts`
- Что: `grant_plan(p_session)` — advisory lock; если уже 'paid' → `('already_granted', chat_id)`; иначе paid + subscriptions + base_plan + unlock chat если locked (either-party). `expire_subscriptions()` — over-due → free, НЕ re-lock open chats. `count_pending_interests`, `count_active_connections`, `plan_limits(plan)` (free 2/0, plus 3/1, pro 5/2). Register в `SET_RETURNING`.
- **Идемпотентность под concurrent replay (advisory lock по session id).**

**REV-3 — Lock chat at mutual [L]** (dep: REV-1, REV-2)
- Файлы: `supabase/migrations/20260703002000_process_interest_plus_gate.sql`, `.../api/interest/route.ts`, `src/lib/v2/tg-outbox-worker.ts`
- Что: `process_interest` mutual-ветка — если ЛЮБАЯ сторона имеет plus/pro активный → open; иначе `locked_requires_plus`, `lock_expires_at=now()+7d`. Active-limit: если >= лимита → locked + distinct result. Return `chat_status`. Route: open → `mutual_match` + `/v2/chats/{id}`; locked → `mutual_interest_locked` + `/v2/tariffs?ctx=mutual&chat={id}`. **Новый OutboxEventType 'mutual_interest_locked' + RU/UZ шаблоны без urgency ('кандидат ждёт' запрещено).**

**REV-4 — Enforce chat_status в message API [M]** (dep: REV-1, REV-3)
- Файлы: `src/lib/chat/live.ts`, `.../chats/[id]/messages/route.ts`, `stream/route.ts`, `read/route.ts`, `typing/route.ts`
- Что: `status` в `loadChatRow` select; locked → typed `{locked:true}` (не 404). 4 роута → 403 `{error:'chat_locked_requires_plus', chat_id}`. Gate = `hasPermission(open_chat) AND chat.status==='open'`. **Не добавлять plus/pro в Role enum.**

**REV-5 — Chat detail page paywall [M]** (dep: REV-1, REV-3, REV-10)
- Файлы: `.../v2/chats/[id]/page.tsx`, `.../v2/chats/page.tsx`, `src/lib/chat/list.ts`, `ChatRoom.tsx`
- Что: page грузит chat напрямую (bypass loadChatRow) → тот же gate. `locked_requires_plus` → paywall вместо composer ('У вас взаимный интерес' + Plus + CTA `/v2/tariffs?ctx=mutual&chat={id}`). `expired` → terminal screen. Chat list маркирует locked. `get_chat_list` RPC возвращает status.
- **Второй independent chokepoint — иначе locked chat рендерит рабочий composer чьи POST 403.**

**REV-6 — Env Click/Payme [S]**
- Файлы: `src/lib/env.ts`, `.env.local.example`
- Что: `.optional()`: CLICK_MERCHANT_ID/SERVICE_ID/SECRET_KEY/MERCHANT_USER_ID, PAYME_MERCHANT_ID/MERCHANT_KEY, PAYMENTS_ENABLED. `paymentsConfig()` бросает при hit webhook без vars. **Optional — required сломает существующие деплои.**

**REV-7 — payment_sessions + create-session API [M]** (dep: REV-1, REV-6, REV-13)
- Файлы: `.../api/payments/session/route.ts`, `src/lib/payments/catalog.ts`, `click.ts`, `payme.ts`
- Что: `requirePermissionForRequest('open_chat')`, body `{plan, duration, provider, source_screen, chat_id?}`. Цена из catalog (PLUS 1m=149000). Insert pending session, analytics `payment_started`. Return checkout URL (Click: pay.click.uz с transaction_param=session.id; Payme: base64 `m=;ac.order_id=session.id;a=tiyin`). **Amount с сервера (Click=сум, Payme=tiyin ×100).**

**REV-8 — Click webhook [L]** (dep: REV-2, REV-7, REV-13)
- Файлы: `.../api/payments/click/webhook/route.ts`, `src/lib/payments/click.ts`
- Что: two-phase (action=0 Prepare, action=1 Complete). MD5 sign_string verify через `safeEqual`. `merchant_trans_id→session.id`, amount match, `provider_txn_id=click_trans_id`. Complete → `grant_plan(session.id)` → analytics `payment_success`+`chat_unlocked` + outbox notify. Click JSON envelope (error codes -1/-4/-5/-9/0). **Verify sign_string field order + error codes против Click Merchant API v2 docs (не по памяти).**

**REV-9 — Payme webhook [L]** (dep: REV-2, REV-7, REV-13)
- Файлы: `.../api/payments/payme/webhook/route.ts`, `src/lib/payments/payme.ts`
- Что: JSON-RPC 2.0, Basic-auth `base64('Paycom:'+MERCHANT_KEY)` через safeEqual. Методы CheckPerformTransaction/CreateTransaction/PerformTransaction (→ grant_plan)/CancelTransaction/CheckTransaction. Error codes -31001/-31003/-32504/-31008. **Verify method set + state machine + codes против Payme docs.**

**REV-10 — Tariffs screen + mutual paywall [L]** (dep: REV-7)
- Файлы: `.../v2/tariffs/page.tsx`, `.../tariffs/plus/page.tsx`, `TariffCards.tsx`, `PlusPaywall.tsx`, `messages/*.json`
- Что: Экран 1 (Free/Plus/Pro + 'Важно'), source_screen tracking; `/v2/tariffs/plus` (Экран 3) — duration selector, Click/Payme picker, POST `/api/payments/session` → redirect. `ctx=mutual&chat={id}` → Экран 2 paywall. **Копия no-pressure (нет таймера, 'кандидат ждёт'); safety block 'не даёт власть / не гарантирует брак'.**

**REV-11 — Pro screen (data-driven price) [M]** (dep: REV-7, REV-10)
- Файлы: `.../v2/tariffs/pro/page.tsx`, `PlusPaywall.tsx`, `catalog.ts`, `messages/*.json`
- Что: Экран 4, цена из catalog (Pro не финализирован — 249/299/399k). `plan='pro'`. Структурно present, не блокировать запуск на финальной цене.

**REV-12 — Plan limits enforcement + limit screens [L]** (dep: REV-2, REV-3, REV-10, REV-13)
- Файлы: `.../api/interest/route.ts`, `.../v2/limits/pending/page.tsx`, `active/page.tsx`, `LimitScreen.tsx`, `src/lib/matching/quota.ts`, `messages/*.json`
- Что: pending >= limit → 409 `pending_interest_limit_reached`. Active >= limit → chat locked + `active_connection_limit_reached`. Экран 5 (pending 3/3) + Экран 6 (active 2/2). **3 разных лимита: daily send cap (5) ≠ pending outstanding ≠ active acquaintances.**

**REV-13 — Analytics events + track helper [S]** (dep: REV-1)
- Файлы: `src/lib/analytics/track.ts`, `events.ts`
- Что: `track(eventType, {userId?, ...props})` → analytics_events. Typed union (payment_started/success/failed, chat_unlocked, subscription_activated/expired, mutual_interest_created/locked_for_free, plus_paywall_shown, ...). **Best-effort, never throws в webhook path** (иначе Click/Payme retry вечно).

**REV-14 — Cron sweeps [M]** (dep: REV-2, REV-3)
- Файлы: `.../api/cron/subscriptions/route.ts`, `.../cron/mutual-lock-expiry/route.ts`, `supabase/migrations/20260703003000_mutual_lock_expiry_fn.sql`
- Что: `/cron/subscriptions` → `expire_subscriptions()` (downgrade, НЕ re-lock open chats). `/cron/mutual-lock-expiry` → `chats.status='expired'` где locked + lock_expires_at<now(). X-Cron-Secret, 503 без secret. Идемпотентно.

**REV-15 — Admin subscription view [M]** (dep: REV-1, REV-2)
- Файлы: `.../admin/clients/[id]/ProfileTab.tsx`, `src/lib/admin/load-client.ts`, `CaseHeader.tsx`
- Что: base_plan, plan_expires_at, subscription status/provider, last payment_session, unlock-after-payment, pending/active usage vs limit. **Строго read-only** (grants/refunds out of MVP).

---

### WS-8: admin_rework — полное покрытие анкеты + danger-zone + дизайн

**Цель:** операторы видят все PD-01..PD-14 поля V4-анкеты; superadmin danger-zone (ban/delete/restart) с confirm+audit; variant-A дизайн (Inter, radius-токены).

**AR-6 — RPC hard_delete + restart_onboarding [M]** (keystone)
- Файл: `supabase/migrations/20260703000000_admin_hard_delete_restart.sql`
- Что: обе SECURITY DEFINER, обёрнуты `ALTER TABLE case_events DISABLE TRIGGER case_events_no_update;` ... `ENABLE` (single txn, no early RETURN between). **НЕ `DISABLE TRIGGER ALL`/session_replication_role** (сломает FK cascade). `admin_hard_delete_user`: delete verification_cases (cascade case_events/notes), затем `DELETE users` (остальные FK ON DELETE CASCADE — верифицировать против init_schema). НЕ трогать document_sha_blacklist/phone_blacklist (SET NULL). `admin_restart_onboarding(...,p_wipe_consents default true)`: guard — blocked/pending_ban → error; delete profiles/photos/quiz/documents/identity/verification_cases (+consents если wipe, per LOCKED DECISION hardcode true); UPDATE users → onboarding_step='language', lifecycle_state='onboarding', сохранить telegram_id+id; manual insert user_state_transitions (bypass forward-only guard). **Audit пишет route, не RPC.**

**AR-7 — Danger-zone API routes [M]** (dep: AR-6)
- Файлы: `.../api/admin/users/[id]/delete/route.ts`, `.../restart-onboarding/route.ts`
- Что: `requireAdminApi()` → 403 если не superadmin → typed-confirm `{confirm:'DELETE'|'RESTART', reason (>=3)}` → optimistic concurrency (re-fetch updated_at). `/delete`: собрать storage paths → `adminAudit` ПЕРЕД RPC (переживает delete) → RPC → best-effort storage cleanup. `/restart`: 409 если blocked/pending_ban, storage cleanup, RPC(wipe=true), audit, notifyUser.

**AR-8 — Danger-zone UI (superadmin-only) [L]** (dep: AR-7)
- Файлы: `.../admin/clients/[id]/ModerationTab.tsx`, `src/lib/admin/load-client.ts`, `page.tsx`
- Что: 'use client' панель (паттерн DecisionPanel), gate на `session.role==='superadmin'` (role из page.tsx:68). Ban state-machine: active → 'Propose ban'; pending_ban → Confirm (disabled если same-admin, two-person rule) + Cancel; blocked → Unban; verification-rejected → Unblock. Superadmin-only bottom: Restart (blocked если blocked/pending_ban) + Delete (typed 'DELETE' input). Fetch pending_ban_by_admin_id/reason/at.

**AR-1 — ProfileTab full SELECT + extended jsonb [S]** (keystone)
- Файл: `src/app/admin/clients/[id]/ProfileTab.tsx` (строки 41-45)
- Что: заменить 16-col SELECT на полный список V4 hot-columns (height_cm, weight_kg, birth_country/region/district/city, activity_field, employment_format, native_language, children_count, youngest_child_age, religion_practice, religion_partner_match, post_marriage_living, family_role_model, wife_work_after_marriage_view, partner_height_min/max, partner_top_qualities, partner_religion_match, partner_preferred_countries, region, country_of_residence, district, district_visible_public, profile_visibility_mode, needs_v4_review) + `extended` jsonb (finance/lifestyle/family). Расширить `Profile` type (:18-36). `npx tsc --noEmit` passes.

**AR-2 — Appearance + Birth place + About-extended [M]** (dep: AR-1)
- Что: PD-01/02/03. Appearance (height/weight); Birth place (self-reported, distinct от passport в IdentityTab, 'Место рождения (по анкете)'); About (activity_field/employment_format/native_language via labelOf). `SectionLabel` headers.

**AR-3 — Family/Values/Religion/Marriage/Family-model + gender-conditional [M]** (dep: AR-1)
- Что: PD-04/05/06/07. Family (children_count/youngest_child_age); Religion (religion_practice/partner_match); Marriage (post_marriage_living); Family-model (family_role_model/wife_work + extended.family). **Использовать `@/lib/profile/gender-wording` (CONST_REGISTRY) с client's gender**, не inline.

**AR-4 — Finance + Lifestyle из extended jsonb [M]** (dep: AR-1)
- Что: PD-08/09. Finance (income_source_stability, financial_stability_importance, family_finance_management, financial_priorities[], monthly_income_range, financial_obligations); Lifestyle (lifestyle_pace, free_time_activities[], daily_routine, bad_habits_level, nutrition_style, alcohol_level, drugs_use). '—' для pre-V4. **alcohol_level/drugs_use визуально флагнуть** (moderation-relevant).

**AR-5 — Partner-extended/Location/Privacy + provenance flag [M]** (dep: AR-1)
- Файлы: `ProfileTab.tsx`, `page.tsx`
- Что: PD-10/11/12/14. Partner (partner_height_min/max, partner_top_qualities, partner_religion_match, partner_preferred_countries); Location (district, district_visible_public badge, region, country_of_residence); Privacy (profile_visibility_mode). PD-14: сравнить анкета gender/birth_date/citizenship vs passport (identity как prop из page.tsx) → 'анкета ≠ паспорт' badge при расхождении; без false-flag для unverified.

**AR-9 — Big Five таб [M]** (independent)
- Файлы: `src/components/admin-ops/ClientTabs.tsx` (:4-10), `page.tsx`, `src/lib/admin/load-quiz.ts`
- Что: PD-13. 6-й таб 'Психотест'. SELECT `vector, completed_at` из quiz_results. 5 trait (O/C/E/A/ES 0-100) как bars с RU-labels (verbatim из `src/lib/quiz/questions.ts`). 'Тест не пройден' если нет row.

**AR-10 — Убрать serif из OpsSidebar logo [S]** (independent)
- Файл: `src/components/admin-ops/OpsSidebar.tsx:94` — `var(--font-v2-display)` → `ADMIN.fontSans` (Inter).

**AR-11 — Radius-токены [M]** (independent)
- Файлы: `src/lib/admin/admin-tokens.ts` + ~15 admin-ops компонентов
- Что: добавить `radius: 6`, `radiusLg: 8`. Grep все inline `borderRadius:` 4/6/8 → ADMIN.radius/radiusLg. Login-card 10px (`login/page.tsx:65`) → radiusLg.

**AR-12 — Body bg-token + font-loading [S]** (independent)
- Файлы: `src/app/admin/layout.tsx`, `src/app/globals.css`
- Что: D5 — `bg-slate-100` → `var(--admin-bg)` #fafaf8 (cold flash). D6 — загрузить Inter через `next/font/google` (сейчас нигде не загружен, fallback на system).

**AR-13/AR-14 — DEFERRED to P1** (не в этом билде): SLA dashboard (due_at/priority), `/admin/reports/[id]` detail view. Трекаются чтобы не потерять.

---

### WS-9: business_matching_p0 — деградация матчинга + воронка

**Цель:** `get_recommendations` деградирует по возрасту вместо empty; North Star + воронка в `/admin/analytics`.

**Два независимых кластера:** MATCH-* (один PR) и FUNNEL-* (второй PR, второй инженер, параллельно).

**MATCH-1 — Relax-level параметр в get_recommendations [M]**
- Файл: `supabase/migrations/20260702000000_recommendations_v4_relax_level.sql`
- Что: `get_recommendations(p_viewer, p_limit, p_relax_level default 0)`. Level 0 = strict (текущее). Level 1 = расширить viewer partner_age_min/max ±5 (**floor 18, никогда ниже**). Level 2 = + drop candidate-side preference clause. **Все остальные фильтры инвариантны на каждом уровне** (lifecycle active, verification approved, published, mutual gender, has-approved-photo, match_views dedup, blocks, existing-request). Return extra `relax_level int` column. **City не релаксится — hard SQL filter нет, только JS-scoring в score.ts.**
- Приёмка: viewer age 25/25, кандидаты 30 → 0 rows level 0, 30-year-old level 1 (25±5=20-30) tagged relax_level=1; invariant fixtures (blocked/no-photo/pending) не текут на level 2. Floor 18 verified.

**MATCH-2 — Progressive relaxation loop [S]** (dep: MATCH-1)
- Файл: `src/lib/matching/recommend.ts` — try level 0 → пусто → level 1 → пусто → level 2 → пусто → `[]`. `relaxLevel` в `Candidate` type. JS scoring без изменений. Регрессия: healthy strict pool → relaxLevel=0, identical output.

**MATCH-3 — Honest match story [S]** (dep: MATCH-2)
- Файлы: `src/lib/v2/match-of-the-day.ts`, `match-story.ts` — при `relaxLevel>0` НЕ claim age-alignment; honest note ('расширили возрастной диапазон'). `relaxLevel=0` → byte-identical output.

**MATCH-4 — Empty state true last-resort [S]** (dep: MATCH-2)
- Файл: `src/app/[locale]/main/page.tsx` (:82-101) — copy-only: не обещать 'завтра точно сработает' (match_views dedup может structurally исчерпать пул). Функциональных изменений нет.

**MATCH-5 — Тесты degradation ladder [S]** (dep: MATCH-2, MATCH-3)
- Файлы: `src/lib/matching/recommend.test.ts`, `match-story.test.ts` — relax-loop (mock RPC per tier), invariant-фильтры на каждом tier, story honesty.

**FUNNEL-1 — get_admin_funnel RPC [M]**
- Файл: `supabase/migrations/20260702010000_admin_funnel.sql`
- Что: паттерн `get_admin_demographics()`. Стадии: signup (deleted_at null), verified (approved), published (status='published'), first_mutual (match_requests accepted), chat_unlocked (chats row). Gender-segmented. `empty_feed_rate` = active+approved+published users для кого `get_recommendations(id,1,0)` (**STRICT tier 0** — не degraded, иначе спрячет проблему) даёт 0 rows, by gender + city. Set-based, не N RPC вызовов на 10k.

**FUNNEL-2 — Воронка section в /admin/analytics [S]** (dep: FUNNEL-1)
- Файл: `src/app/admin/analytics/page.tsx` — 'Воронка' section (паттерн Демография), `unwrapOne(await ...rpc('get_admin_funnel'))`, funnel bars + conversion % (`pct()`), GenderBar, empty_feed_rate by-city table. Footnote: first_mutual==chat_unlocked пока (ensureChat синхронный).

**FUNNEL-3 — SLA/drop-off counters [S]** (dep: FUNNEL-1)
- Файлы: тот же migration (не второй RPC), `analytics/page.tsx`
- Что: 2 доп ключа на `get_admin_funnel()`: `onboarding_completion_rate` (lifecycle!=onboarding / total — proxy, app_opened не трекается, задокументировать), `verification_approval_rate` (approved / submitted). MiniStat cards.

**FUNNEL-4 — North Star metric [S]** (dep: FUNNEL-1)
- Файлы: `supabase/migrations/20260702020000_admin_north_star.sql`, `analytics/page.tsx`
- Что: `verified_mutual_interests_with_chat_started` (chat13 §2.1): pairs both approved+published + match_requests accepted + chats row + >=1 chat_messages. **Safety qualifiers (complaints_in_first_N_days=0, block_right_after_start=false) — proxy** (exclude pairs с reports/blocks, без time-window). SQL comment цитирует chat13 §2.1 + delta. Top-line 'Северная звезда' stat.

---

## 4. Критический путь

**Что блокирует запуск и от чего зависит:**

1. **Legal согласия ← юрист-копия.** LC-4/LC-5 не могут финализироваться без финальной RU/UZ формулировки и точного списка чувствительных категорий от юриста. Код везёт `LAWYER_REVIEW`, но запуск с плейсхолдерами юридически недопустим для чувствительных ПД (Cluster A). **Юрист — на критическом пути; бриф выдать в Sprint 0.**

2. **Revenue webhooks ← subscription-схема ← мерчант.** REV-8/REV-9 зависят от REV-1 (схема) + REV-2 (grant RPC) + REV-6 (env) + мерчант-креды Click/Payme. Sign-string/error-codes сверять с актуальными docs. **Мерчант-интеграция — параллельный внешний лид-тайм; провижн бакетов/ключей в Sprint 0.**

3. **TOTP enforcement ← ручной enrollment живого superadmin.** SEC-2c enforcement НЕ включать до того как superadmin реально прошёл SEC-2b на проде (иначе self-lockout). Мержить последним.

4. **Backup restore-тест ← backup работает.** SEC-1c (реальный restore) блокирует запуск — первый restore часто вскрывает битый tar / не тот ключ. Acceptance = restore проведён, не «скрипт есть».

5. **SSE rewrite ← PgBouncer.** DB-3 зависит от DB-1 (нужен DATABASE_DIRECT_URL для non-pooled LISTEN). DB-1 — сам крупнейший fix (DBS-01), землить первым.

6. **Chat gating chain.** REV-3 (lock) → REV-4 (API enforce) + REV-5 (page paywall). REV-5 — второй independent chokepoint, пропуск = рабочий composer с 403-POST.

7. **verification VER-1 keystone.** Разблокирует VER-2..VER-6; land первым, self-enforcing инвариант.

8. **Off-site backup /data ≠ Railway managed snapshot.** Managed snapshot может покрывать только БД, не volume → SEC-1a обязателен отдельно.

---

## 5. Оценка суммарного объёма

Подсчёт по S/M/L/XL (грубо: S≈0.5, M≈1, L≈2 чел-недели; XL нет).

| Воркстрим | S | M | L | Чел-недели (грубо) |
|-----------|---|---|---|--------------------|
| verification | 5 | 1 | 0 | ~3.5 |
| appsec_p0 | 5 | 3 | 0 | ~5.5 |
| infra_security_p0 | 6 | 5 | 3 | ~14 |
| db_scale_p0 | 2 | 5 | 1 | ~8 |
| observability_p0 | 6 | 3 | 0 | ~6 |
| legal_consent_p0 | 2 | 5 | 2 | ~10 |
| revenue_mvp | 2 | 6 | 6 | ~19 |
| admin_rework | 3 | 6 | 1 | ~9.5 |
| business_matching_p0 | 6 | 2 | 0 | ~5 |
| **ИТОГО** | **37** | **36** | **13** | **~80 чел-недель** |

**Интерпретация:** ~80 чел-недель совокупного объёма. При команде 3-4 инженера + параллелизации (2 независимых кластера в матчинге, appsec IDOR-half независим от PII-half, дизайн-полировка параллельна) и внешних лид-таймах (юрист/мерчант в фоне) реалистичный календарный срок — **~4 спринта (8 недель)** до launch-ready, если Sprint 0 стартует всей командой немедленно. Revenue (19 чел-недель) и infra-security (14) — самые тяжёлые; их лучше вести выделенными инженерами с первого спринта.

---

## 6. Открытые решения (требуют ответа учредителя)

**verification:**
- VER-4 scope-предикат: 'user has an open case' (рекомендация) vs assigned/unassigned+new. Подтвердить перед кодингом.
- VER-5 scheduler: Railway scheduled job (реком.) vs cron-job.org.
- SLA idle window: 168h (7d) vs короче (48-72h) для быстрого surfacing заброшенных на 10k. Product-решение.

**appsec:**
- Скрывать religion pre-mutual? Сейчас РЕНДЕРится (locked founder decision 2026-06-25). Acceptance таргетит UNRENDERED поля. Legal Cluster A считает religion sensitive — **не стрипать унилатерально**; решение founder+юрист.
- bio pre-mutual — тот же locked decision, держать (anti-contact sanitized).
- VER-8 stream route open_chat parity — fold в этот воркстрим или defer к P1 session-hardening?

**infra_security:**
- Off-site target: **R2 (реком., нет egress)** vs S3. Нужно решение + провижн.
- Encryption key: age/gpg symmetric (реком., zero-trust) — **где хранится оффлайн-копия ключа** (иначе backup нерасшифруем при потере env).
- Backup runner: endpoint под X-Cron-Secret (реком., только web видит /data) vs отдельный job.
- TOTP: hand-roll RFC 6238 (реком.) vs otplib/@noble.
- Recovery codes для TOTP: делать в MVP или принять риск ручного SQL-reset? (потеря телефона = lockout).
- Cron reliability: Railway scheduled jobs (реком.) vs GH free-tier + dead-man's-switch.
- Alert channel: Telegram ops-chat (реком.) vs Slack/Sentry.
- Rate-limit store: in-memory (реком. для флуда) + Postgres-fallback для bootstrap. **ВЕРИФИЦИРОВАТЬ middleware in-process.**

**db_scale:**
- DBS-04: option (a) скорить всех viable в JS (реком. MVP, проверить viable-set bounded) vs (b) port score в SQL. Решить после DB-7/DB-8 на seed.
- PgBouncer hosting: отдельный Railway service/sidecar vs managed pooler. Подтвердить топологию Railway.
- LISTEN/NOTIFY (реком.) vs Redis pub/sub.
- NOTIFY delivery: DB-триггеры (реком., атомарность) vs app-level pg_notify.
- Typing over NOTIFY: нужен ли канал для ephemeral typing (6s TTL) или local optimistic?

**legal_consent:**
- Юрист: финальная RU/UZ копия + точный enum-список чувствительных категорий + 2-checkbox labels для Screen 3/4.
- Withdrawal semantics: (a) status-flip (реализуется сейчас) vs (b) + purge собранных полей (follow-up retention-matrix).
- Позиция sensitive-gate: перед profile_finance (реком.). Religion sensitive для MVP-gating? (сейчас на profile_values без gate).
- consent_type taxonomy: identity/verification consent (Screen 5) out of scope P0? (сейчас в bot 'biometric').

**revenue_mvp:**
- Either-party vs both-party unlock: **either-party (реком.)** — free-rider revenue implication, подтвердить.
- Chat fate on expiry: **grandfather open chats (реком.)**, downgrade только limits/new-chat. Подтвердить.
- Mutual-interest retention: **7d (реком.)**, configurable.
- Pro price: 249/299/399k — не финализирована; MVP SKU = Plus 149k, Pro data-driven.
- Gifting — out of MVP (locked). payment_sessions.kind='gift' reserved.
- 'Active acquaintance' def: open chat row (реком.); 'finish acquaintance' action — follow-up.

**admin_rework:**
- Restart-onboarding consents WIPE — **уже locked founder decision**, hardcode true в AR-6/AR-7.
- RU-labels для 5 Big Five traits — verbatim из `src/lib/quiz/questions.ts`.
- AR-9 quiz-таб visibility — un-gated (both roles) vs superadmin-only. Подтвердить.

**business_matching:**
- North Star formula: safety qualifiers (complaints/block) не computable без event pipeline → **proxy (реком.)**, delta в SQL comment. Подтвердить или descope к v2.
- first_mutual == chat_unlocked сегодня (ensureChat синхронный) — показывать дубль-колонки с footnote? Подтвердить.
- Degradation ladder: только age (city нет hard filter) — подтвердить narrower scope.
- match_views permanent dedup — sparse-pool user исчерпает пул даже после relax; re-surface after N days out of scope P0.

---

_Полный ТЗ также сохранён в `/private/tmp/claude-501/-Users-fayzullohoja-Desktop/fbca3beb-bb2b-47bb-b46d-8f94e1360cf5/scratchpad/master-p0-plan.md`._
---

## 7. Разрешённые решения учредителя (2026-07-02)

- **Бэкап off-site:** Cloudflare R2 (без egress). Шифрование age/gpg; ключ хранит учредитель оффлайн (пароль-менеджер/сейф), НЕ только в env.
- **Религия pre-mutual:** остаётся видимой (решение учредителя 2026-06-25; сверить с юристом в рамках legal-контура, не стрипать унилатерально).
- **SLA-окно заброшенных кейсов:** 7 дней (168ч, как сейчас).
- **Команда:** Claude — основной исполнитель, последовательно; учредитель ревьюит и пушит. План исполняется под один поток (без параллельных живых инженеров пока).

Порядок старта: **Sprint 0, задача VF-1 первой** (keystone верификации).
