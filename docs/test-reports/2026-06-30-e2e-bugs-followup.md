# E2E test report — 2026-06-30 (followup)

Followup-сессия после первичного отчёта `2026-06-30-e2e-bugs.md` (35 багов, 30 закрыто).
Live UI прогон через Maestro (Java 17 + Maestro 2.5.1) + Telegram WebApp на Samsung
A23 (RR8W103WWMD) + workflow-аудит (4 параллельных read-only агента, 39 sub-agents,
35 candidates → 32 confirmed).

## Окружение

- HEAD: `f206416` + uncommitted edits в bot-api/handlers/messages, tg-outbox-worker, InterestActions (другая сессия)
- Прод: `https://baxtlilar-mvp-production.up.railway.app`
- DB: thomas.proxy.rlwy.net (DATABASE_PUBLIC_URL)
- Тест-юзер: `5934330381` (Jakhongir / Zayniddin), language=uz, `lifecycle=onboarding`, `step=doc_upload` на момент прогона
- Maestro: 2.5.1 (через openjdk@17 из brew); MCP-tooling Maestro в сессии отсутствует, прогон через `~/.maestro/bin/maestro` + `adb shell` + uiautomator dump
- Артефакты:
  - Скриншоты: `/tmp/baxt-screens-followup/000-initial.png` ... `005-reopened-app.png`
  - UI dumps (xml): `/tmp/baxt-screens-followup/00{0,3,4,5,6}-dump.xml`
  - Server-rendered HTML 24 V2 экранов: `/tmp/baxt-screens-followup/uz-*.html`
  - Findings: `/tmp/baxt-screens-followup/findings.json`
  - Forged cookie phantom-user: `/tmp/baxt-phantom-cookie`

## Что проверено

TODO-чеклист из предыдущего отчёта:
- [x] State machine integrity (ALLOWED_TRANSITIONS, dead-ends, orphans)
- [x] API validation (Zod coverage на onboarding routes)
- [x] Migration consistency (V2/V3 column lifecycle)
- [x] Bug #33 (V3 matching fields — confirmed + extended)
- [x] tg_outbox event types coverage
- [x] Photos: MAX_PHOTOS, replace flow, primary swap
- [x] Profile completion edge cases
- [x] Admin: cmd+K, SLA, reasons templates
- [x] Blacklist enforcement (phone & document SHA)
- [x] Locale routing
- [x] Secrets/env hygiene
- [x] V3 spec compliance (spec docs не доступны напрямую — отмечено)
- [x] **Live UZ-локализация на каждом экране** (новое)

## Статус из предыдущего отчёта (verified)

| Bug | Что | Статус |
|---|---|---|
| #2 | verification_case insert на selfie | ✅ FIXED commit `06196a8` (`src/app/api/onboarding/selfie/route.ts:75,82`) |
| #19-#22 | bot URL locale + verify pages i18n | ✅ FIXED commits `ce815dc`, `e0696fb`, `675dc48` |
| #23-#25 | anketa eyebrow/titles | ✅ FIXED commits `1c0723a`, `5235d31`, `5a7947d` |
| #33 | V3 matching orphan columns | ⚠️ DEFERRED, ПОДТВЕРЖДЁН снова (см. #44, #45 ниже) |
| #34-#35 | a11y | ✅ FIXED commit `f206416` |
| `values` column drop | Sprint 3 cleanup | ✅ VERIFIED — колонка удалена, только `top_life_values` |
| Bug #11 SLA reclaim | Migration 20260630010000 | ✅ APPLIED, RPC работает (но без audit row, см. #61) |

---

## КРИТИЧНЫЕ И MAJOR (12 шт.)

### Bug #36 [critical] — Redirect loop /main для pending_ban users

**File:** `src/lib/state-machine/router.ts:73`

`nextScreenFor` switch не имеет `case "pending_ban":` — после `admin_ban_propose`
у user `lifecycle_state='pending_ban'` + `onboarding_step='active'`, попадает в
default arm → `ONBOARDING_PATHS['active']='/main'`. На /main `requireActiveUser`
через `isActiveAccessAllowed` отказывает (pending_ban не в active/paused),
→ redirect обратно в `nextScreenFor` → '/main' → **loop**. Это **тот же класс
бага C1**, который документирован в `src/lib/auth/active-access.ts:6-9` для paused.

**Fix:** policy-decision (два варианта):
- **Option A (рекомендую)** — INVISIBLE PROPOSAL: pending_ban это внутреннее
  предложение двух-админ rule с 24h auto-cancel. Пользователю не должно быть
  заметно. Trat `pending_ban` like `active`: в `isActiveAccessAllowed` вернуть
  true для `pending_ban`, в `nextScreenFor` mirror `active`. Реальный /blocked
  только при `admin_ban_confirm`.
- **Option B** — VISIBLE TERMINAL: `case "pending_ban": return "/blocked";`
  и тот же mirror в `src/lib/state-machine/client-paths.ts:53`. Минус: tip-off
  пользователю про предложение, которое может истечь.

### Bug #37 [major] — pending_ban отсутствует в TS LifecycleState → 500 на permission-gated API

**File:** `src/lib/state-machine/types.ts:3`

DB enum имеет `pending_ban` (migration `20260619500000_admin_oversight.sql:12`),
admin_ban_propose RPC выставляет его. Но TS union в `types.ts` его не имеет;
`DbUser` cast laundered the runtime value. `deriveRole` (`src/lib/v2/permissions.ts:70-85`)
— switch без default arm → возвращает `undefined` → `hasPermission` →
`ROLE_PERMISSIONS[undefined].includes(...)` → **TypeError: Cannot read properties
of undefined**. Каждый endpoint guarded `requirePermissionForRequest` отдаёт 500
для pending_ban user: `/api/interest`, `/api/block`, `/api/report`, `/api/feed/skip`,
`/api/chats/[id]/messages`, `/api/chats/[id]/read`, `/api/chats/[id]/typing`,
`/api/requests/[id]/decision`. 354/354 vitest зелёный потому что
`permissions.test.ts:9-36` не покрывает pending_ban.

**Fix:**
1. `types.ts:3` — добавить `"pending_ban"` в union (TS surface every non-exhaustive switch).
2. `permissions.ts` — `case "pending_ban": return "blocked";` (re-use blocked role; GDPR floor permissions ОК) + `default: assertNever(...)`.
3. `with-permission.ts:55` — explicit short-circuit `if (lifecycle_state === "pending_ban") return 403 { error: "blocked" }` ДО `deriveRole` (belt-and-suspenders).
4. Tests: `deriveRole("pending_ban", *)`, integration `requirePermissionForRequest("send_interest")` returns 403 not 500.

### Bug #38 [major] — profile_visibility_mode не enforce'ится в matching

**File:** `supabase/migrations/20260630000000_recommendations_v3_top_life_values.sql:11`

V3 анкета privacy экран собирает `profile_visibility_mode` (`everyone` /
`verified_only` / `by_request`), но `get_recommendations` RPC игнорирует. Профили
с `verified_only` или `by_request` показываются всем — **privacy promise нарушено**.

**Fix:** добавить WHERE clause в RPC: фильтровать candidates по
`cp.profile_visibility_mode` относительно viewer статуса. Для `by_request` —
не показывать в feed вообще, требовать interest token.

### Bug #39 [major] — Bug #33 ПОДТВЕРЖДЁН и расширен: V3 матчинг игнорирует 8 hot-полей

**Files:** `src/lib/matching/score.ts`, `src/lib/v2/match-of-the-day.ts:42`, `src/lib/v2/match-story.ts`

V3 анкета записывает (миграция `20260629000000_anketa_v3_hybrid.sql` помечает
комментарием "Ключевой для matching"): `family_role_model`,
`wife_work_after_marriage_view`, `partner_top_qualities`, `activity_field`,
`employment_format`, `birth_country`, `birth_region`, `birth_district`,
`birth_city`, `partner_height_min`, `partner_height_max`. Score формула в
`score.ts` использует ТОЛЬКО: city, age, religion, top_life_values,
partner_age_min/max, geo_preference. `loadFullProfile` в match-of-the-day.ts
SELECT'ит только 13 V2 колонок. `match-story.ts ProfileForMatch` type omits
new fields. **User даёт данные на 11 экранах, алгоритм пользует ~5**.

Это та же находка что в первичном отчёте Bug #33 + добавляются новые
конкретные columns.

**Fix:** Sprint 4 task. Решение product о весах:
- family_role_model match → +15
- partner_top_qualities overlap → +N per match
- activity_field similarity → +5
- birth_country/region — bonus
- partner_height_min/max — hard filter

### Bug #40 [major] — AnketaPhotosForm не hydrate существующие photos → dead-end после reload

**File:** `src/components/v2/AnketaPhotosForm.tsx:24`

При reload на `/v2/anketa/photos` форма всегда показывает empty state.
Уже загруженные фото в `profile_photos` table не подтягиваются в UI. User не
может удалить/заменить уже загруженное и может зацикленно загружать новое, пока
не упрётся в MAX_PHOTOS=3.

**Fix:** `useEffect` загрузить `GET /api/onboarding/profile/photos` (создать
endpoint если нет), отрисовать каждую с возможностью delete. Также добавить
"Сохранить и продолжить" CTA после хотя бы 1 photo.

### Bug #41 [major] — user_profiles.city written-never (V3), но read everywhere

**File:** `src/lib/matching/score.ts:18`, повсюду

V3 анкета **не пишет** `user_profiles.city` (basicSchema dropped city field
после region cleanup в Bug #1). Но `score.ts`, `match-story.ts`, admin
ProfileTab всё ещё SELECT'ят city. У всех V3 юзеров `city=NULL` → score даёт 0,
admin показывает пустое поле, MatchStory не упоминает локацию.

**Fix:** либо (a) задним числом backfill city из region (cities table mapping),
либо (b) убрать city из всех SELECT и заменить на region везде.

### Bug #42 [major] — Bug #33 extends to match-of-the-day loader (дубль)

**File:** `src/lib/v2/match-of-the-day.ts:42`

Same finding из другого agent angle — `loadFullProfile()` SELECT включает только
старые V2 колонки. Фиксится вместе с #39.

### Bug #43 [LIVE major] — TutorialStep.tsx "Пропустить тур" hardcoded RU

**File:** `src/components/v2/TutorialStep.tsx:50`

```jsx
{showSkip && (
  <button ...>
    Пропустить тур
  </button>
)}
```

Используется на 4 tutorial pages (intro, swipe, chat, safety). UZ юзер видит
"Пропустить тур" русскими буквами. `messages/ru.json:587` уже имеет ключ
`Tutorial.skipTour` который не используется в коде. Также внутри `messages/ru.json`
**Tutorial namespace дублирован** в flat (`intro.title`) и nested (`intro: { title }`)
форматах — нужно унифицировать.

**Fix:** Заменить hardcoded строку на `t("skipTour")` через `useTranslations("Tutorial")`.
Добавить `skipTour: "Turni o'tkazib yuborish"` в `messages/uz.json` Tutorial namespace.

### Bug #44 [LIVE major] — body class="bg-baxt-pink-bg text-baxt-navy" → V1 FUOC на каждой странице

**File:** `src/app/[locale]/layout.tsx:39` + `src/app/globals.css:77-82`

В каждом HTML response видно `<body class="min-h-full bg-baxt-pink-bg
text-baxt-navy">`. Затем `<div data-v2="true" style="background:var(--color-v2-paper)..."`
перекрывает. На каждом render — flash of V1 pink перед mount компонента.
Уже зафиксировано в `docs/V2-AUDIT-PLAN-2026-06-28.md` как P1.1 (gating fix).

**Fix:** см. P1.1 в audit plan. body → `bg-v2-paper text-v2-ink-100 data-v2="true"`,
gated по self-skin V1 страниц (`/blocked`, `/onboarding/{rejected,needs-changes}`).

### Bug #45 [LIVE major] — `/uz/v2/anketa/looking-for` содержит RU копи

**Files:** `messages/uz.json` + likely компонент form для looking-for

Server-rendered UZ html:
```
До
От
От и до — фильтр алгоритма. Не строгая граница, просто чтобы не показывать совсем мимо.
```

Подтверждено через curl с phantom-user в `profile_looking_for` step.

**Fix:** добавить UZ переводы для:
- `LookingFor.range_from` = "Yoshdan"
- `LookingFor.range_to` = "Yoshgacha"
- `LookingFor.range_hint` = "Yoshdan va yoshgacha — algoritm filtri. Qat'iy chegara emas, faqat butunlay mos kelmaydiganlarni ko'rsatmaslik uchun."

Также — looking-for legacy fallback, заслуживает marker `@deprecated V3` (см. #51 ниже).

### Bug #46 [LIVE major] — `/uz/v2/anketa/partner-extended` содержит RU копи

**Files:** likely `src/components/v2/AnketaPartnerExtendedForm.tsx`

Server-rendered UZ html:
```
Выбери от 1 до 5 — это ключ к подбору. Выбрано: 0/5
Диапазон, от 18 лет.
```

**Fix:** добавить UZ переводы для:
- `PartnerExtended.qualities_hint` = "1 dan 5 tagacha tanlang — bu mos kelishning kalitidir. Tanlangan: {count}/5"
- `PartnerExtended.age_range_hint` = "Yosh oraligʻi, 18 yoshdan."

Использовать `useTranslations("PartnerExtended")` в форме компонента.

### Bug #47 [LIVE minor → bumped major] — UZ грамматические ошибки в verify/doc

**File:** `messages/uz.json` Verify.doc namespace

Live screen `/v2/verify/doc` (UZ locale):
- "**Shunday — raddigan**" → грамматически неверно, должно быть "**Bunday — yaramaydi**" или "**rad etiladi**"
- "**Yaltijon va soyasiz**" → `yaltijon` диалект/ошибка, должно быть "**Yaltirashsiz**" (без бликов)
- "**Tahrirlanmagansiz — filtrsiz, ramkasiz va muqovasiz**" → `-siz` суффикс превращает в "вы не редактированы" (нонсенс); должно быть "**Tahrirlanmagan — filtrsiz, ramkasiz va muqovasiz**"

Severity: bumped from minor to major т.к. видно живому юзеру на первом
verification экране (high-visibility entry point).

**Fix:** native speaker review всего `messages/uz.json` Verify.* и Anketa.*
namespaces. UZ переводы машинно-кальковые местами.

---

## MINOR (16 шт.)

### Bug #48 — Photo upload count check + max(ord)+1 не атомарны (race)

**File:** `src/app/api/onboarding/profile/photo/route.ts:22`

`SELECT count` → 2 awaits (formData + storage upload) → INSERT. Race: 2 concurrent
uploads оба проходят count check (count=2), оба computeNextOrd=3, оба INSERT →
4 photos / duplicate ord. Уникального индекса на `(user_id, ord)` нет. Файл сам
admits это в комментарии.

**Fix:** `CREATE UNIQUE INDEX profile_photos_user_ord_uq ON profile_photos(user_id, ord)`
+ atomic INSERT...SELECT WHERE count < 3. Map unique_violation (23505) → 409.

### Bug #49 — Photo DELETE: storage object удаляется до DB row → dangling row

**File:** `src/app/api/onboarding/profile/photo/[id]/route.ts:26`

Удаление в storage перед удалением DB строки. Если DB delete падает — остаётся
row, указывающая на удалённый file. У user 404 при загрузке photo + не может
удалить второй раз.

**Fix:** swap порядок: DELETE FROM profile_photos сначала, THEN storage object
(или wrap в transaction с rollback).

### Bug #50 — Photo MAX_PHOTOS check TOCTOU (race 4+ uploads)

Same class race как #48, отдельный finding agent'а — оба фиксятся одним FOR UPDATE.

### Bug #51 — profile_looking_for legacy dead step для new V3 users

**File:** `src/lib/state-machine/types.ts:42, 116, 119, 122`

ALLOWED_TRANSITIONS marriage → [partner_extended, looking_for], но `marriage/route.ts:46-49`
hardcoded'но переходит только в `partner_extended`. Legacy остался для users
застрявших в profile_looking_for до V3.

**Fix:** 2-phase: (1) `@deprecated V3 — fallback only` comment рядом с enum
entry. (2) После DB sweep (`SELECT count(*) WHERE onboarding_step='profile_looking_for'`)
дропнуть из enum + удалить page + route + `partner_extended` стабится без legacy.

### Bug #52 — `notifyUser` обходит outbox для admin block notification

**File:** `src/lib/admin/guard.ts:213`

После `admin_ban_confirm` notification идёт прямо через `notifyUser` (legacy
Telegram bot send) — без retry, без локали из `users.language`. Outbox event
type `account_banned` не enqueue'ится.

**Fix:** заменить `notifyUser(...)` на `enqueue_tg_outbox(user_id,
'account_banned', payload)` + `tryDeliverNow(id)`. Локализация автоматом по
`users.language`.

### Bug #53 — Legacy looking-for route жив, пишет geo_preference; V3 partner-extended hardcoded geo='my_city'

**File:** `src/app/api/onboarding/profile/looking-for/route.ts:11`, `src/app/api/onboarding/profile/partner-extended/route.ts:46-58`

Legacy looking-for route ещё активна (для legacy users) и пишет `geo_preference`
из form. V3 partner-extended hardcoded'но `geo_preference: 'my_city'` (всегда).
Несогласованно: V3 user не может выбрать geo_preference, legacy user может.

**Fix:** добавить geo_preference в V3 partner-extended schema/form, либо удалить
поле из user_profiles если V3 product решение — нет geo filter.

### Bug #54 — Blacklisted document upload leaves orphan file в storage

**File:** `src/lib/uploads/storage.ts:21`

`uploadDocumentImage` → upload storage → `isDocumentBlacklisted(sha)` check ПОСЛЕ
upload → 400 → но файл уже в storage и никогда не удаляется.

**Fix:** SHA compute сделать ДО upload и проверить blacklist ДО storage write.
Или storage cleanup при 400 response.

### Bug #55 — Form-data schemas не используют `.strict()` — silently dropped unknown keys

**File:** `src/lib/profile/schemas.ts:82`

Без `.strict()` Zod silently drops unknown fields. Если frontend отправляет extra
field, он не валидируется и не пишется → debugging confusion.

**Fix:** добавить `.strict()` ко всем onboarding form schemas.

### Bug #56 — Admin reports decision API не идемпотент на status transitions

**File:** `src/app/api/admin/reports/[id]/decision/route.ts:34`

Если модератор 2 раза кликнет "action_taken" — два audit-row, два status update.
Должен быть NOOP при повторе.

**Fix:** UPDATE WHERE status != $newStatus, return 409 если row 0.

### Bug #57 — Publish completeness check не валидирует V3-required hot columns

**File:** `src/app/api/onboarding/profile/publish/route.ts:17`

Check включает 8-9 V2 полей. V3 hot fields (family_role_model,
partner_top_qualities, marriage_format, religion_practice, education,
employment) не проверяются. State-machine guarантирует прохождение всех экранов,
но defense-in-depth не повредит.

**Fix:** расширить check на все V3 hot columns. Если null → 400 profile_incomplete
с указанием missing fields.

### Bug #58 — Tg_outbox: `tutorial_reminder` event type defined но never enqueued

**File:** `src/lib/v2/tg-outbox-worker.ts:25`

TEMPLATES имеет `tutorial_reminder`, но никто не enqueue'ит. Dead template.

**Fix:** либо удалить из TEMPLATES + CHECK constraint, либо добавить enqueue
из cron `/api/cron/housekeeping` для юзеров без `tutorial_seen_at` > N часов.

### Bug #59 — Cmd+K command palette stub disabled (admin UI false promise)

**File:** `src/components/admin-ops/OpsTopBar.tsx:22`

Admin top bar показывает ⌘K hint, но handler не подключён. Tooltip обманывает.

**Fix:** либо реально подключить cmdk + базовые actions (Go to / queue / clients),
либо скрыть hint.

### Bug #60 — Нет case watchers / SLA visualization в moderator UI

**File:** `src/lib/admin/load-queue.ts:47`

Queue list не показывает overdue marker (несмотря на SLA reclaim RPC из Bug #11).
Модератор не видит "этот case ждёт 96h".

**Fix:** в `load-queue` добавить computed `overdue_hours = now() - claimed_at`.
В UI badge "просрочено" для > 12h.

### Bug #61 — Hardcoded admin reason templates → UZ моды читают RU

**File:** `src/app/admin/cases/[id]/page.tsx:28`

Templates вытащены из `admin_reason_templates` table только в RU. UZ модератор
видит RU тексты.

**Fix:** добавить `language` column в `admin_reason_templates` + filter by
admin's language preference (или add fallback).

### Bug #62 — meta description hardcoded RU на UZ pages

**Files:** likely `src/app/[locale]/layout.tsx`

`<meta name="description" content="Платформа для серьёзных знакомств с целью создания семьи"/>`
независимо от locale. UZ юзер шарит preview link → RU description.

**Fix:** locale-aware metadata через `generateMetadata({ params: { locale } })`
с переводом из messages.

### Bug #63 — `ALLOWED_TRANSITIONS` позволяет skip V3 anketa screens

**File:** `src/lib/state-machine/types.ts:107`

Некоторые transitions перепрыгивают через required V3 экраны (e.g., из
profile_basic можно сразу в profile_photos минуя 9 promised screens). Через
прямой API POST это возможно.

**Fix:** linearize V3 transitions: каждый шаг разрешает ТОЛЬКО next + back-to-preview
(если applicable). Никаких skip.

---

## TECH-DEBT (8 шт.)

| # | File | Issue |
|---|---|---|
| #64 | `types.ts:122` | `profile_preview` back-transitions list omits 5 V3 steps (spec drift, no functional bug yet) |
| #65 | `types.ts:42` (looking_for) | дубль #51 — orphan step, нужен deprecation marker |
| #66 | `family-model/route.ts:5` | unused `splitHotCold` import (lint should catch) |
| #67 | `schemas.ts:126` | `valuesSchema`, `familySchema` валидируют DROPPED V2 columns |
| #68 | `extendedSchema`/`validateExtended` (schemas.ts:263) | dead code — extended jsonb пишется без валидации |
| #69 | `storage.ts:97` | photo path использует `Date.now()` → re-upload leaks bucket entries |
| #70 | `verification_case_sla.sql:27` | SLA reclaim RPC не пишет audit row при автосбросе claim |
| #71 | `src/app/[locale]/v2/anketa` | V3 анкета реализует 13 из ~17 spec screens — deferred by design, недокументировано |

---

## Не подтверждено / дроп (3 шт.)

3 finding из 35 candidates сброшены при adversarial verify как false-positive
(см. `findings.json` для деталей).

---

## Открытые вопросы для product

1. **pending_ban UX (Bug #36):** Option A (invisible proposal, юзер не знает)
   vs Option B (visible terminal /blocked сразу при propose)?
2. **profile_visibility_mode (Bug #38):** что должен видеть юзер с
   `by_request`? Полное скрытие из feed или "skeleton card + Request to view"?
3. **V3 spec compliance (#71):** какие 4 spec screens deferred? Список из
   "Чат 2 анкета.docx" нужен.
4. **Native UZ speaker review:** кто проверит `messages/uz.json` Verify.* +
   Anketa.* (#43, #45, #46, #47)?
5. **geo_preference (Bug #53):** V3 показывает только "my_city" — это
   намеренно или regression?
6. **city column (Bug #41):** backfill через region→city mapping, или сместить
   все references на region?

---

## Что сделать в первую очередь (приоритет)

**Sprint 1 (1-2 дня):**
1. Bug #37 — `pending_ban` TS + permissions (S, blocker для admin ban flow)
2. Bug #36 — redirect loop pending_ban (S, depends on policy decision)
3. Bug #43 — TutorialStep skipTour UZ (XS, visible to UZ users каждый онбординг)
4. Bug #47 — UZ грамматика verify/doc (XS, native speaker нужен)
5. Bug #44 — body bg V1 leak (S, gating fix per V2-audit-plan P1.1)

**Sprint 2 (2-3 дня):**
6. Bug #39, #42 — V3 matching extension (M, продуктовое решение о весах)
7. Bug #38 — profile_visibility_mode enforce (M, privacy promise)
8. Bug #40 — AnketaPhotosForm hydrate (S, dead-end UX)
9. Bug #41 — city/region SELECT consistency (S, выбор approach)
10. Bug #45, #46 — UZ копи looking-for + partner-extended (XS each)

**Sprint 3 — minor & tech-debt cleanup:** #48-#71 в batched commits.

---

## Артефакты теста

- `/tmp/baxt-screens-followup/` — 5 скриншотов device, 5 uiautomator dumps, 24 server-rendered UZ HTML
- `/tmp/baxt-screens-followup/findings.json` — полные 32 findings с verifier reasoning + fix_refined
- `/private/tmp/claude-501/.../tasks/w49nos0i7.output` — workflow raw transcript (39 agents, 2M tokens)
- `docs/test-reports/2026-06-30-e2e-bugs.md` — первичный отчёт (35 bugs, 30 fixed)

Test phantom-user был создан и удалён в рамках сессии. Реальный test-юзер `5934330381`
не задет — продолжает на `/v2/verify/doc` UZ-локали.
