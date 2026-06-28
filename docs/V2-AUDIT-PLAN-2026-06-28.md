# V2 Audit Implementation Plan — 2026-06-28

> Source audit: `/private/tmp/.../tasks/wf0i0g0ij.output` (61 confirmed findings)
> Project HEAD at planning time: `66559be` + 3 local commits (A, B1, B2)
> Status after admin-redesign sweep: many admin findings already closed

## Executive Summary

The audit landed 61 findings across 8 dimensions. After cross-checking against the recently-merged admin redesign (commits `ae0d46c`, `35da009`, `66559be`, A/B1/B2), **9 of 15 admin-panel findings are already closed** — V2AdminShell and V1 AdminShell are deleted, all admin pages use OpsShell, the photo-reject drawer collects reason via `reasonTemplates`, the hardcoded `#b8475e` and `rgba(180,...)` colors are gone, and OpsSidebar no longer has broken links (its menu was reduced from 14 items to 7 — all live routes). The plan reorganizes the remaining 52 live findings into 8 sequenced phases by theme, not dimension.

The product has two genuine non-cosmetic P1s that need to land first: (a) `pending_ban` is missing from the TypeScript `LifecycleState` union, so `deriveRole` returns `undefined` and every gated route 500s with `TypeError: Cannot read properties of undefined (reading 'includes')` plus a `/main` redirect loop — any user the admin proposes to ban has their app fully broken for the 24h two-person-rule window; (b) the entry-flow `/open-in-telegram` page is the public cold-traffic landing surface with a debug `[diag]` banner permanently rendered, V1 coral palette, dead `bg-baxt-bg` token, no editorial error states for `token_replay` / `account_blocked` / `expired_session`, and no styles loaded at all because root `app/layout.tsx` does not exist — this is the first and possibly only brand impression for non-TG-WebView visitors.

The recommended sequence: **Phase 1 (entry flow editorial + foundation)** lands the global body-bg flip, BottomNav V2, /open-in-telegram editorial rewrite with proper error states, root layout, and global-error/not-found pages — visible to every cold-open user. **Phase 2 (state machine + permissions hardening)** closes the `pending_ban` crash and the `/api/account` permission bypass. **Phase 3 (matching + privacy)** wires city localization on the Match-of-the-Day hero and adds defense-in-depth on `/v2/profile/[id]` + `/api/interest`. **Phase 4 (notification delivery)** migrates user-to-user TG pushes onto the durable outbox with UZ copy. **Phase 5 (admin gaps)** ships the two-person-ban UI (currently zero working path to permanent-ban) and the report decision reason capture. **Phase 6 (V1 sweep finish)** ports remaining V1 surfaces (rejected, needs-changes, blocked, legal, requests) to V2 editorial and removes the legacy `@theme` token block. **Phase 7 (data integrity / RPC defense-in-depth)** atomic-claims the outbox and adds bilateral guards on `process_interest`. **Phase 8 (tech-debt sweep)** for tracked future cleanups.

Immediate impact after Phase 1: the entire app stops showing V1 pink as a default body color, every screen with the bottom nav stops showing a coral active tab, the cold-traffic entry stops looking like a half-broken debug page, and the city slug `olmaliq` on Match-of-the-Day becomes `Алмалык`. After Phase 2 the `pending_ban` 500 disappears and `/api/account` stops admitting shadow users to pause_account.

## Phase Breakdown

| Phase | Theme | Tasks | Total Estimate |
|-------|-------|-------|----------------|
| 1 | Entry flow + editorial foundation | 7 | ~3 days |
| 2 | State machine + permissions hardening | 4 | ~1 day |
| 3 | Matching engine + viewer privacy | 5 | ~1 day |
| 4 | Notification delivery + UZ copy | 3 | ~1.5 days |
| 5 | Admin gaps | 4 | ~1.5 days |
| 6 | V1 surface migration | 5 | ~2 days |
| 7 | Data integrity hardening | 3 | ~1 day |
| 8 | Tech debt (deferred) | 10 | as available |
| **Total** | | **41 tasks** | **~11 days net** |

---

## Quick Wins (ship inside Phase 1, all XS/S, big visible impact)

| ID | Task | Estimate | Impact |
|----|------|----------|--------|
| QW.1 | City localization in `ProgressiveProfile` (P3.1) | XS | Match-of-the-Day hero stops showing `olmaliq`/`qoshtepa` raw slugs |
| QW.2 | Remove diag banner in `auto-bootstrap.tsx` (P1.4 part) | XS | Every cold-open user stops seeing `[diag]` strings |
| QW.3 | Delete dead `bg-baxt-bg` className in `/open-in-telegram` (P1.6) | XS | No visible change, but unblocks token cleanup |
| QW.4 | Delete dead `language-switcher.tsx` (P6.4) | XS | Removes one dead-code surface; zero call sites confirmed |

The body-bg flip (P1.1) is presented as 5 minutes of editing but has a real gate: must self-skin 3 V1 pages first. See Risks.

---

## Phase 1 — Entry Flow & Editorial Foundation

**Theme:** What every new and returning user sees first. The body default, the entry landing, the BottomNav chrome, the error screens. Closes design-residue P1s and entry-flow P1s.

### P1.1 — Flip root `<body>` to V2 paper background

- **Files:** `src/app/[locale]/layout.tsx:39`, `src/app/globals.css:77-82`
- **Approach:** Change body className from `bg-baxt-pink-bg text-baxt-navy` to V2 default (`bg-v2-paper text-v2-ink-100` + `data-v2="true"`). Update `body` rule in globals.css to use V2 tokens. **Gating prerequisite:** verify that `/blocked`, `/onboarding/rejected`, `/onboarding/needs-changes` self-set their own bg on their root wrapper — if not, add `bg-baxt-pink-bg` explicitly to those pages BEFORE flipping body, otherwise they'll inherit V2 paper while still rendering V1 chrome.
- **Estimate:** S (gated by 3-page audit)
- **Acceptance:** Cold-open any V2 screen → no V1 pink flash on initial paint; V1 pages (`/requests`, `/legal/*`, etc.) still render their pink chrome correctly; no FOUC.
- **Related findings:** `Root <body> в [locale]/layout.tsx использует V1 розовый фон и navy текст`

### P1.2 — New `src/components/v2/BottomNav.tsx` and swap 4 imports

- **Files:** create `src/components/v2/BottomNav.tsx`; modify `src/app/[locale]/main/page.tsx`, `src/app/[locale]/v2/chats/page.tsx`, `src/app/[locale]/v2/profile/[id]/page.tsx`, `src/app/[locale]/v2/settings/page.tsx`
- **Approach:** Build V2 BottomNav with identical prop shape (`active`, `unread?`). Replace emoji icons with inline SVG line-icons (stroke 1.5px, currentColor), active tab = `var(--color-v2-ink-100)`, inactive = `var(--color-v2-ink-400)`, container `borderTop: 1px solid var(--color-v2-ink-500)` over paper. Replace numeric coral pill with 6px ink-100 dot (matches the file's own declared principle in `v2/chats/page.tsx:6`). Keep `pb-[env(safe-area-inset-bottom)]`, `fixed bottom-0`, `max-w-screen-sm`. Do NOT touch `bottom-nav.tsx` — it stays for `/requests` until V1 sweep.
- **Estimate:** M
- **Acceptance:** Visual diff `/main` + `/v2/chats` + `/v2/profile/[id]` + `/v2/settings` — zero coral pixels; `/requests` unchanged.
- **Related findings:** `Все V2 страницы импортируют V1 BottomNav (коралловый акцент)`

### P1.3 — Rewrite `/open-in-telegram/page.tsx` as editorial mini-landing

- **Files:** `src/app/open-in-telegram/page.tsx`
- **Approach:** Drop coral B-badge, drop V1 `bg-baxt-card` modal, drop dead `bg-baxt-bg` class. Replace with responsive landing container (`max-w-[560px]` paper background) using V2 visual language (eyebrow + serif H1 + Lead + Button primary). Keep `<Script telegram-web-app.js>`, `<AutoBootstrap />`, `dynamic = 'force-dynamic'`. Server-side `pickLocale` from cookies/headers (default `uz`), inline `COPY = { ru, uz }` const — do not import next-intl on this locale-agnostic route. Bilingual stack collapsed to one chosen locale.
- **Estimate:** S
- **Acceptance:** Open `/open-in-telegram` in browser → editorial paper card with one CTA `Открыть в Telegram` / `Telegram'da ochish` (locale-picked); no coral; AutoBootstrap still redirects on success.
- **Related findings:** `/open-in-telegram оформлен в V1 бренде (coral/розовый)`, `Bilingual mix RU+UZ в одном экране без переключателя`, `Используется несуществующий Tailwind токен bg-baxt-bg`, `/open-in-telegram копия не объясняет ЧТО это`, `MiniAppShell footer вертикально подвисает к низу...`

### P1.4 — Replace `[diag]` banner in `auto-bootstrap.tsx` with editorial error states

- **Files:** `src/app/open-in-telegram/auto-bootstrap.tsx`
- **Approach:** Delete the unconditional debug banner (lines 117-124). Implement state machine that emits `loading | success | error`: loading silent for 500ms then `Открываю Baxtlilar…`; success silent (still `window.location.replace('/')`); error branches by cause via a `mapErrorToState(status, error)` helper covering `expired_session` (reload CTA), `replay_or_bad_link` (open-bot CTA), `account_blocked` (support CTA), `register_required` (keep existing bilingual, just re-skin), `generic_error` (reload). Move all `[diag]` strings to `console.debug`. Use editorial `ErrorState` component (paper bg, serif heading, sans body, ink-100 / ink-300, ink-100 button). NEVER expose `status` or raw `error` string.
- **Estimate:** M
- **Acceptance:** Manually trigger each error code via dev tools → user sees editorial card with actionable CTA, no `[diag]` text anywhere; production unchanged in success path.
- **Related findings:** `Permanently visible diag-banner с техническими [diag] сообщениями`, `Bootstrap-ошибки (token_replay, bad_start_param, account_blocked, expired initData) НЕ показывают человеческого экрана`

### P1.5 — Create root `src/app/layout.tsx` with html/body/fonts/globals.css

- **Files:** create `src/app/layout.tsx`
- **Approach:** Minimal root layout — `<html lang="ru" className={geistSans.variable + geistMono.variable + ' h-full antialiased'}>`, `<body className="min-h-full bg-v2-paper text-v2-ink-100">`, `import './globals.css'`, Geist subsets `['latin','cyrillic']`. Do NOT move `<Script telegram-web-app.js>` from `[locale]/layout.tsx` (keep one source). The `[locale]/layout.tsx` keeps its own `<html lang={locale}>` — accept Next.js nested-html warning OR convert `[locale]/layout.tsx` to fragment and set `lang` via `document.documentElement.lang` from a client component in `[locale]/layout.tsx`. **Pick fragment approach** to avoid nested html lint.
- **Estimate:** M (refactor risk — touches every route)
- **Acceptance:** `/open-in-telegram` now loads globals.css + Geist Cyrillic; `/[locale]/...` routes unchanged visually; no nested-html warning in console; HTML `lang` attribute correct per locale.
- **Related findings:** `Отсутствует root app/layout.tsx — /open-in-telegram рендерится без html/body, шрифтов`

### P1.6 — Editorial `global-error.tsx`, `[locale]/error.tsx`, `not-found.tsx`

- **Files:** `src/app/global-error.tsx`, `src/app/[locale]/error.tsx`, create `src/app/[locale]/not-found.tsx` (and add `NotFound` namespace to `messages/ru.json`, `messages/uz.json`)
- **Approach:**
  - `global-error.tsx` must stay inline-styles (no globals.css/Tailwind available): hard-code `#FAF6F1` bg, `#0A0908` ink, serif heading via `ui-serif, Georgia, ...`, pill button `#4A2C5A` bg.
  - `[locale]/error.tsx`: V2 tokens (`bg-v2-paper text-v2-ink-100 font-v2-display` for h1), pill button `bg-v2-accent text-v2-paper`, keep `useTranslations('Error')`. Do NOT wrap in MiniAppShell (might depend on context that just crashed).
  - `[locale]/not-found.tsx`: MiniAppShell + Headline (`Страница не найдена` / `Sahifa topilmadi`) + Lead + Button to `/`.
  - Also re-skin `src/app/admin/error.tsx:37` (`bg-baxt-coral` → admin-accent slate-blue token).
- **Estimate:** S
- **Acceptance:** Manually throw in a V2 page → editorial card; visit `/ru/nonexistent` → editorial 404; visit `/admin/nonexistent` (auth'd) → admin-skinned error.
- **Related findings:** `/blocked, /legal/[slug], error.tsx, open-in-telegram, requests — V1 розовая палитра` (error.tsx portion), `global-error.tsx и [locale]/error.tsx не используют V2 editorial DNA`, `Отсутствует not-found.tsx`

### P1.7 — Editorial loading hook for global cold path

- **Files:** create `src/app/[locale]/loading.tsx`
- **Approach:** MiniAppShell with minimal Lead `Загружаем…` to prevent V1 default fallback paint during async page loads. Optional but high-leverage given Phase 1's emphasis on first-paint cleanliness.
- **Estimate:** XS
- **Acceptance:** Throttle network → see editorial loading state instead of blank/V1-pink.
- **Related findings:** Tangential to design-residue cluster.

---

## Phase 2 — State Machine & Permissions Hardening

**Theme:** Close the runtime-crash P1 and the actual permission bypass that lets shadow users pause their account.

### P2.1 — Add `pending_ban` to `LifecycleState` + exhaustive `deriveRole`

- **Files:** `src/lib/state-machine/types.ts:3`, `src/lib/v2/permissions.ts:70-86`, `src/lib/auth/active-guard.ts:17-19,28-30`, `src/lib/state-machine/router.ts:47-60`
- **Approach:**
  1. Extend `LifecycleState` union: add `"pending_ban"`.
  2. In `deriveRole` add `case "pending_ban": return "blocked";` (treat as blocked from user POV — F-119 two-person rule says user must not be told they're proposed-for-ban, so blocked UX is safer than active during the 24h window). Append `const _exhaustive: never = lifecycleState` exhaustiveness check.
  3. In `requireActiveUser` / `loadActiveUserApi` treat `pending_ban` same as `blocked` → redirect to `/blocked` / return 403 blocked.
  4. In `nextScreenFor` add `case "pending_ban": return "/blocked";` before default arm.
  5. Add exhaustive test in `src/lib/v2/permissions.test.ts` iterating every LifecycleState × VerificationStatus.
- **Estimate:** S
- **Acceptance:** Simulate `lifecycle_state='pending_ban'` user → no 500, no `/main` loop, lands on `/blocked`; new test passes.
- **Related findings:** `pending_ban lifecycle state не описан в TS — runtime crash во всех гардах` (P1)

### P2.2 — Per-action permission gate in `/api/account`

- **Files:** `src/app/api/account/route.ts:18`, possibly `src/lib/v2/with-permission.ts`
- **Approach:** Replace `loadActiveUserApi({ allowPaused: true })` with per-action `requirePermissionForRequest(permMap[action])`. permMap: `pause→pause_account, resume→resume_account, delete→delete_account, export→export_account`. This (a) blocks shadow from pause, (b) activates the 4 dead permission keys, (c) lets blocked users export/delete per documented GDPR floor. **Critical:** keep the blocking-rejected guard at lines 46-61 (C6 fix — protects sha_blacklist evidence). Note: response code for shadow→pause changes from 409 to 403 — update frontend if it parses code.
- **Estimate:** S
- **Acceptance:** Tests: shadow + pause → 403; blocked + export → 200 (GDPR); blocked + delete → 200 (with blocking-reject guard still active); paused + resume → 200.
- **Related findings:** `/api/account (pause/resume/delete/export) обходит withPermission слой 2`, `Inconsistent paused-flag в SettingsActions`

### P2.3 — UI gate on `V2SettingsActions` (defense layer 1)

- **Files:** `src/app/[locale]/v2/settings/page.tsx`, `src/components/v2/SettingsActions.tsx`
- **Approach:** In page, compute `canPause = hasPermission(role, 'pause_account')` and `canResume = hasPermission(role, 'resume_account')`. Pass as props or conditionally render the pause section. Shadow users see no pause button; delete-account section still renders (shadow has delete_account permission).
- **Estimate:** XS
- **Acceptance:** Shadow user on `/v2/settings` sees only delete; verified user sees pause; paused user sees resume.
- **Related findings:** `Inconsistent paused-flag в SettingsActions — UI хайдит resume но API позволяет` (companion to P2.2)

### P2.4 — Document & assert `ENFORCED_PERMISSIONS` vs `NON_ROUTE_PERMISSIONS`

- **Files:** `src/lib/v2/permissions.ts`, `src/lib/v2/permissions.test.ts`
- **Approach:** Split Permission union into two exported tuples: `ENFORCED_PERMISSIONS` (the 8 keys that pass through `requirePermissionForRequest`) and `NON_ROUTE_PERMISSIONS` (the 14 keys enforced on other echelons — state-machine transitions, loadUserForStep, RPC). Add `satisfies readonly Permission[]` and a test asserting their union covers the whole `Permission` union. Annotate each `NON_ROUTE_*` key with where its real enforcement lives. Update header comment at `permissions.ts:13` to mention "withPermission OR step-machine for /api/onboarding/*".
- **Estimate:** S
- **Acceptance:** Test fails if next dev adds new Permission key without classifying it.
- **Related findings:** `Mass dead permission keys — объявлено 24, реально enforced 8`, `Onboarding API routes используют loadUserForStep вместо withPermission`, `Bot/SMS legacy onboarding steps не имеют ALLOWED_TRANSITIONS` (also covered — annotate as terminal-by-design), `Роль rejected недостижима` (drop the role)

---

## Phase 3 — Matching Engine & Viewer Privacy

**Theme:** Hero-screen polish + defense-in-depth on viewer pages.

### P3.1 — Localize city in `ProgressiveProfile` *(Quick win — XS)*

- **Files:** `src/components/v2/ProgressiveProfile.tsx:126`
- **Approach:** `import { cityLabel } from '@/lib/profile/cities'`; replace `{profile.city ? <span>{profile.city}</span> : null}` with `{profile.city ? <span>{cityLabel(profile.city, locale)}</span> : null}`. The `locale` prop is already plumbed (default `'ru'`). `cityLabel` falls back to raw value for unknown slugs.
- **Estimate:** XS
- **Acceptance:** Match-of-the-Day hero shows `Алмалык` instead of `olmaliq` for RU locale; UZ-locale users see `Olmaliq`.
- **Related findings:** `City slug rendered raw in ProgressiveProfile (pre-mutual)` — adjusted to P1 visible-on-hero

### P3.2 — Add permission gate to `/v2/profile/[id]` and `/v2/chats/[id]`

- **Files:** `src/app/[locale]/v2/profile/[id]/page.tsx:49`, `src/app/[locale]/v2/chats/[id]/page.tsx:35`
- **Approach:** After `requireActiveUser(locale)`, compute `viewerRole = deriveRole(...)` and gate: profile page requires `view_feed`, chats page requires `open_chat`. On fail redirect to `/main`. Closes Echelon 2 gap — currently shadow users could view any profile UUID directly (no UI surfaces it, but contradicts documented 4-эшелонная защита).
- **Estimate:** XS
- **Acceptance:** Shadow user manually hitting `/v2/profile/<uuid>` redirects to `/main`.
- **Related findings:** `V2 /v2/profile/[id] page uses bare requireActiveUser — shadow viewer bypasses permission gate`

### P3.3 — Narrow SELECT on pre-mutual `/v2/profile/[id]`

- **Files:** `src/app/[locale]/v2/profile/[id]/page.tsx:58`
- **Approach:** Split the SELECT into pre-mutual and post-mutual branches. Pre-mutual: only `display_name, city, bio, religion, values, education, employment, vector`. Define `ProgressivePublicProfile` type that excludes `birth_date, marital_status, has_children, children_plan, religion_importance, partner_age_min/max, geo_preference`. Tighten `ProgressiveProfile`'s `profile` prop type.
- **Estimate:** S
- **Acceptance:** TypeScript prevents over-render; pre-mutual page fetches fewer columns.
- **Related findings:** `/v2/profile/[id] over-fetches sensitive columns it does not render pre-mutual`

### P3.4 — Deterministic tie-break in `get_recommendations` RPC

- **Files:** new migration extending `supabase/migrations/20260626000000_v2_recommendations_viewer_gate.sql`
- **Approach:** Add `order by c.id` before `limit p_limit` at line 69. UUID order is arbitrary but stable across reads — prevents F5-rotation of top-1 candidate on equal composite scores.
- **Estimate:** XS
- **Acceptance:** Repeated calls return same candidate set for same viewer (modulo time-based filters).
- **Related findings:** `RPC has no ORDER BY for ties; F5 can rotate top-1 candidate`. The deeper fix (`user_daily_match` table) is tracked in Phase 8.

### P3.5 — Friendly handling for pre-mutual `/v2/profile/[id]` reached via direct URL

- **Files:** `src/app/[locale]/v2/profile/[id]/page.tsx:144`
- **Approach:** In pre-mutual branch, check if `id === getMatchOfTheDay(viewer.id)`. If yes → `redirect('/main')`. If no → render existing profile + small Lead under ProgressiveProfile: `Эта рекомендация больше не активна`. Do NOT add InterestActions here — contradicts the "one recommendation/day, action from /main" model.
- **Estimate:** XS
- **Acceptance:** Stale share-link doesn't dead-end silently; today's MotD share-link routes to action surface.
- **Related findings:** `Pre-mutual /v2/profile/[id] has no 'Send interest' CTA — dead-end if reached via direct URL`

---

## Phase 4 — Notification Delivery & UZ Localization

**Theme:** Migrate user-to-user pushes onto the durable outbox; fix UZ users getting RU copy.

### P4.1 — Extend `tg_outbox` event_type CHECK constraint + worker templates

- **Files:** new migration, `src/lib/v2/tg-outbox-worker.ts:21,48`
- **Approach:**
  1. Migration: `ALTER TABLE tg_outbox DROP CONSTRAINT tg_outbox_event_type_check; ADD CONSTRAINT ... CHECK (event_type IN (existing 4 + 'new_interest','interest_mutual','interest_accepted','new_chat_message','account_banned'))`.
  2. Extend `OutboxEventType` union with 5 values.
  3. Add RU+UZ templates to `TEMPLATES` map (locale auto-resolves via `loadUserForOutbox` reading `users.language`).
- **Estimate:** S
- **Acceptance:** `enqueue_tg_outbox` accepts new event types; worker renders correct locale.
- **Related findings:** `Чат/interest пуш-уведомления только на русском`, `notifyUser обходит outbox` (setup half)

### P4.2 — Replace 4 `notifyUser` call-sites with outbox enqueue + tryDeliverNow

- **Files:** `src/app/api/interest/route.ts:57-63`, `src/app/api/requests/[id]/decision/route.ts:89`, `src/app/api/chats/[id]/messages/route.ts:105`, `src/lib/admin/guard.ts:213`
- **Approach:** For each: `const { data: id } = await sb.rpc('enqueue_tg_outbox', { p_user_id, p_event_type, p_payload: {} }); await tryDeliverNow(id);`. **Keep** `shouldPush` throttle wrapper in `chats/messages/route.ts` — outbox shouldn't accumulate throttled events. Add `lifecycle_state !== 'deleted'` guard before enqueue. Rename `notify.ts` to `_legacyNotifyUser` (or delete and rely on tsc to catch missed call-sites).
- **Estimate:** M
- **Acceptance:** Stop Telegram API briefly during test → notifications retry from outbox; UZ user receives UZ-locale push.
- **Related findings:** `notifyUser обходит outbox`, `Interest notifications bypass durable tg_outbox`, `Push-уведомления outbox идут без inline-кнопки 'Открыть приложение'` (covered by P4.3)

### P4.3 — Add inline `Open App` button to outbox messages + sendMessage refactor

- **Files:** `src/lib/v2/tg-outbox-worker.ts:96-113`, extract `src/lib/telegram/deeplinks.ts`, reuse `src/lib/telegram/bot-api.ts:sendMessage`
- **Approach:**
  1. Extract `buildAppWebUrl` + `openAppButton` from `src/lib/telegram/bot/handlers.ts` (currently file-private) into shared `src/lib/telegram/deeplinks.ts`.
  2. Delete duplicate `sendBotMessage` in worker, import `sendMessage` from `bot-api.ts` (already has AbortSignal timeout + structured logging + ReplyMarkup typing).
  3. In `processOutboxEvent` build keyboard via `shouldShowOpenApp(event_type, payload)` — false for `verification_rejected` with `reject_category='blocking'` (text routes to support, not app); for that case attach url button to `https://t.me/baxtlilar_support`.
- **Estimate:** S
- **Acceptance:** Approved verification push has tappable "Открыть Baxtlilar" inline button that opens Mini App at signed deeplink; blocking-reject has support button.
- **Related findings:** `Push-уведомления outbox идут без inline-кнопки`, `tg-outbox worker sendBotMessage без timeout` (closed by switching to bot-api.sendMessage which has timeout)

---

## Phase 5 — Admin Gaps

**Theme:** What survived the admin redesign. Most admin findings closed; 4 real issues remain.

### P5.1 — Two-person ban UI flow (P1 — currently zero working path)

- **Files:** find current ban entry point (likely in `src/app/admin/clients/[id]` Moderation tab — file doesn't exist yet, was `user-actions.tsx` deleted in cleanup), create `src/app/admin/audit/pending-bans/page.tsx`, possibly add badge support to OpsSidebar
- **Approach:**
  1. **Part A — propose path:** wherever the current ban button lives (search `src/app/admin/clients/[id]` ClientTabs Moderation), update fetch to POST `{ action: 'propose', reason }` to `/api/admin/users/[id]/ban`. Label "Предложить блокировку", explain in dialog that second super-admin must confirm within 24h. Distinguish 409/400/403 in error alerts.
  2. **Part B — confirm/cancel page:** create `/admin/audit/pending-bans`. Server component selecting users where `lifecycle_state='pending_ban'` JOIN admin_users for proposer. For each row render two buttons (super-admin only, admin.id != proposer.id for confirm): "Подтвердить блокировку" → POST `{action:'confirm'}`; "Отменить" → POST `{action:'cancel', reason}`. Show countdown to 24h auto-cancel.
  3. **Part C — sidebar badge:** add `badge?: number` field to OpsSidebar `Item` type; pre-fetch pending_ban count in admin layout and render as numeric pill near the link.
- **Estimate:** L
- **Acceptance:** Admin A clicks "Предложить блокировку" → user enters pending_ban (blocked UX per P2.1). Admin B opens `/admin/audit/pending-bans` → sees row → clicks confirm → user transitions to blocked.
- **Related findings:** `UserActions для permanent ban не используют two-person rule UI flow` (bumped to P1)

### P5.2 — Report decision UI captures reason

- **Files:** `src/components/admin/report-actions.tsx`
- **Approach:** Wrap each of the 3 status buttons in a Dialog with optional textarea (required min-10-chars for `action_taken`/`escalated`, optional for `in_progress`/`not_confirmed`). POST `{status, reason}` — backend already accepts `reason` and audits it. Expose missing `escalated` and `closed` statuses while editing. Style with V2 paper/ink tokens (admin-scoped, not Tinder).
- **Estimate:** S
- **Acceptance:** Audit log entries for report decisions now contain `reason` text; new statuses visible.
- **Related findings:** `Report decision UI не собирает reason`

### P5.3 — Reports list: chat preview + drill-down fixes

- **Files:** `src/app/admin/reports/page.tsx:121,195`, new `src/app/api/admin/reports/[id]/chat-messages/route.ts`
- **Approach:**
  1. Fix wrong href: line 121 `/admin/users` → `/admin/clients/${r.target_user_id}`.
  2. Add GET `/api/admin/reports/[id]/chat-messages` (super-admin only + scope check + audit `report_chat_viewed`). Returns last 50 messages from `chats` table via supabaseAdmin.
  3. In reports/page.tsx add collapsible `<details>Посмотреть переписку</details>` above ReportActions that lazy-fetches on open.
  4. Add `?reason=` filter via searchParams.
- **Estimate:** M
- **Acceptance:** Super-admin can read chat context inline; clicking target name lands on client card; audit log records every view.
- **Related findings:** `Reports moderation: нет показа сообщений чата, привязка к chat_id обрезана`

### P5.4 — Auto-advance to next case after decision

- **Files:** `src/app/api/admin/cases/[id]/decision/route.ts`, `src/components/admin-ops/case/DecisionPanel.tsx`
- **Approach:** Extend the decision response to atomically return `next_case_id` (selected under same auth/role filter already enforced for the decision). Client uses returned id to `router.push('/admin/cases/' + nextId)`; if null, push `/admin/queue/mine` with empty-queue toast. Keep current approve→clients/{userId} redirect optional via a small toggle (post-Sprint follow-up).
- **Estimate:** S
- **Acceptance:** Moderator decides → lands on next case immediately, no back-to-list intermediate.
- **Related findings:** `После decision модератор теряет контекст очереди`

---

## Phase 6 — V1 Surface Migration & Token Cleanup

**Theme:** Bring the explicitly-retained V1 pages onto V2 editorial DNA, then sweep dead tokens.

### P6.1 — Port `/onboarding/needs-changes` + `needs-changes-form.tsx` to V2

- **Files:** `src/app/[locale]/onboarding/needs-changes/page.tsx`, create `src/components/v2/needs-changes-form.tsx`
- **Approach:** Replace V1 `<Screen>` with MiniAppShell + Headline + Lead. Replace amber alert with editorial warning block (`bg-v2-paper-2 border-l-2 border-v2-warning px-4 py-3`). Build V2 needs-changes-form mirroring `v2/verify/doc` + `v2/verify/selfie` UX (FilePick on `bg-v2-paper-2 border border-v2-border hover:border-v2-ink-300`, no dashed coral border, errors via `text-v2-warning` not baxt-coral-dk, Submit via V2 `Button variant='primary'` full-width). Reuse i18n keys.
- **Estimate:** M
- **Acceptance:** Visual diff with `v2/verify/doc` → consistent; reject reason renders; resubmit triggers correct transition.
- **Related findings:** `/onboarding/needs-changes — V1 Screen + amber alert + baxt-coral dashed border`, `needs-changes and rejected pages render V1 styling`

### P6.2 — Port `/onboarding/rejected` + retry-button + support-link to V2

- **Files:** `src/app/[locale]/onboarding/rejected/page.tsx`, create `src/components/v2/RetryButton.tsx`, create `src/components/v2/SupportLink.tsx`
- **Approach:** Page on MiniAppShell + Headline/Lead. Replace `bg-baxt-coral-bg` alert with neutral surface (`rounded-2xl bg-v2-paper-2 border border-v2-paper-3 px-4 py-4 text-sm text-v2-ink-200`). For blocking branch optionally hint via `border-v2-warning`. New V2 RetryButton uses V2 Button + `useRouter` from `@/i18n/navigation`. New V2 SupportLink uses V2 Button `variant='ghost'` as `<a>` with `rel="noopener noreferrer"`. Leave legacy files in place until usage drops to zero.
- **Estimate:** S
- **Acceptance:** Both reject branches render editorial; retry transitions correctly; support link opens.
- **Related findings:** `/onboarding/rejected — V1 Screen + baxt-coral-bg alert + V1 RetryButton`

### P6.3 — Port `/blocked`, `/legal/[slug]`, `/requests`, `pending-actions.tsx`

- **Files:** `src/app/[locale]/blocked/page.tsx`, `src/app/[locale]/legal/[slug]/page.tsx`, `src/app/[locale]/requests/page.tsx`, `src/components/onboarding/pending-actions.tsx`
- **Approach:**
  - `/blocked`: replace `<Screen>` with MiniAppShell + neutral V2 notice. Edge-case page but consistency matters.
  - `/legal/[slug]`: V2 paper main, draft-banner on `bg-v2-warning-soft`, article wrapper on `bg-v2-paper-2`.
  - `/requests`: full V2 migration — MiniAppShell, tabs on `v2-ink-100/v2-ink-400`, cards on `bg-v2-paper-2 border-v2-border`, V2 BottomNav (now exists from P1.2), V2 RequestActions (replace `bg-baxt-coral` accept button with V2 Button primary, decline with ghost).
  - `pending-actions.tsx`: replace coral CTA with V2 Button primary + V2 Button ghost. This is hit by every approved user via moderation_pending happy path — high ROI.
- **Estimate:** L
- **Acceptance:** `grep -rn "baxt-coral\|baxt-pink\|baxt-navy" src/app/[locale]/onboarding src/app/[locale]/requests src/app/[locale]/blocked src/app/[locale]/legal src/components/onboarding` → zero hits.
- **Related findings:** `/blocked, /legal/[slug], error.tsx, open-in-telegram, requests — V1 розовая палитра`, `LanguageSwitcher и RequestActions — V1 coral CTA` (RequestActions portion)

### P6.4 — Delete dead `language-switcher.tsx` *(Quick win — XS)*

- **Files:** delete `src/components/language-switcher.tsx`
- **Approach:** Grep confirmed zero call sites. V2 has no language switcher — locale auto-detected via TG.
- **Estimate:** XS
- **Acceptance:** Build passes; one less V1 component.
- **Related findings:** `LanguageSwitcher и RequestActions — V1 coral CTA` (LanguageSwitcher portion)

### P6.5 — Remove V1 `@theme` token block from `globals.css`

- **Files:** `src/app/globals.css:3-16, 77-82`
- **Approach:** **Gating prerequisite:** `grep -rn "baxt-coral\|baxt-pink\|baxt-navy\|baxt-card\|baxt-muted\|baxt-border\|baxt-coral-bg\|baxt-coral-dk" src/` must return zero. If yes, delete the V1 `@theme` block and the V1 body default. Replace body default with V2 paper/ink (or leave to `[data-v2="true"]` rule + add equivalent for non-V2 routes that should also default to paper).
- **Estimate:** XS (after gate)
- **Acceptance:** `grep baxt- src/` returns zero; no visual change; bundle slightly smaller.
- **Related findings:** `V1 brand токены всё ещё в globals.css @theme`

---

## Phase 7 — Data Integrity Hardening

**Theme:** Outbox atomicity + bilateral RPC guards. Low user-visible-blast-radius but architecturally important.

### P7.1 — Atomic claim for `tg_outbox` (eliminates duplicate Telegram messages)

- **Files:** new migration (extends `tg_outbox` table), `src/lib/v2/tg-outbox-worker.ts:149-179,188-209`
- **Approach:**
  1. Migration: `ALTER TABLE tg_outbox ADD COLUMN claimed_at timestamptz, telegram_message_id bigint`. Add partial index `(created_at) WHERE sent_at IS NULL AND claimed_at IS NULL`.
  2. Add SECURITY DEFINER RPCs `claim_tg_outbox_batch(p_limit, p_lease)` and `claim_tg_outbox_one(p_id, p_lease)` using `UPDATE … WHERE id IN (SELECT id … FOR UPDATE SKIP LOCKED)` pattern.
  3. Worker: replace direct SELECTs with RPC calls. `processOutboxBatch` → only iterate rows returned by claim_batch. `processOutboxEvent` → start with `claim_one`; empty result = already-handled, return true. `markFailed` → clear `claimed_at` so retry happens next tick. `markSent` → add `.is('sent_at', null)` as belt-and-suspenders.
- **Estimate:** M
- **Acceptance:** Concurrent admin approval + cron tick → only one Telegram delivery; killed worker → row reclaimable after 2-minute lease expires.
- **Related findings:** `tg_outbox worker has check-then-act race — duplicate Telegram messages on concurrent drain`, `tg_outbox: нет atomic claim — at-least-once с дублями`

### P7.2 — Bilateral state guard in `process_interest` RPC

- **Files:** new migration extending `supabase/migrations/20260602170000_process_interest_fix.sql`
- **Approach:** After `pg_advisory_xact_lock` at line 23, add:
  ```sql
  if not exists (select 1 from users where id = p_sender and lifecycle_state='active' and verification_status='approved') then
    return query select 'sender_not_eligible'::text, null::uuid; return;
  end if;
  if not exists (select 1 from users where id = p_receiver and lifecycle_state='active' and verification_status='approved') then
    return query select 'receiver_not_eligible'::text, null::uuid; return;
  end if;
  ```
  In `src/app/api/interest/route.ts:57` add `case "sender_not_eligible"|"receiver_not_eligible": return 404 unavailable`. Also align the route's TS pre-check to include `verification_status === 'approved'` for fast-fail. Make RPC `security definer set search_path = public, pg_temp`.
- **Estimate:** S
- **Acceptance:** Send interest to a shadow UUID (via raw HTTP) → 404 unavailable; no row written; no TG push to receiver.
- **Related findings:** `Defense-in-depth: process_interest RPC не проверяет lifecycle/verification обеих сторон`, `TOCTOU: target.lifecycle_state check в /api/interest вне advisory lock`, `/api/interest target check omits verification_status`

### P7.3 — Permanent-lockout recovery on `/v2/welcome`

- **Files:** `src/app/[locale]/v2/welcome/page.tsx`
- **Approach (Option A — server-side self-healing):** Before render, check `user.onboarding_step === 'ready'`. If yes, call `tryTransition(user.id, {onboarding_step: 'active', lifecycle_state: 'active'}, 'welcome: ready→active retry', {kind: 'user', id: user.id})`. On success, redirect to `/main`. On failure, render welcome with retry CTA. Self-healing on next page load; zero new API surface; route 409 in tutorial/route.ts:40-48 doesn't block us because we skip that route entirely.
- **Estimate:** XS
- **Acceptance:** Manually set user to `onboarding_step='ready'` → next `/v2/welcome` load lands user on `/main`.
- **Related findings:** `Permanent lockout loop: /v2/welcome -> /v2/tutorial/intro when user stuck at step=ready`

---

## Phase 8 — Deferred Tech Debt

Tracked, low priority, do when adjacent work happens.

| ID | Task | Severity | Notes |
|----|------|----------|-------|
| P8.1 | Add `user_daily_match` table for stable Match-of-the-Day | P3 | Real fix for tie-break; product contract clarification needed |
| P8.2 | TG initData Ed25519 signature verification | P3 | Defense-in-depth for BOT_TOKEN compromise; requires extracting+deleting both `hash` AND `signature` before HMAC dataCheckString |
| P8.3 | Edit/back CTA on `/v2/anketa/preview` | P3 | Per-section "изменить" ghost links; state-machine transition already allows it |
| P8.4 | `pending/page.tsx` capture transition result + nextScreenFor fallback | P3 | Latent loop, narrow race window |
| P8.5 | Tutorial skip for returning users (`tutorial_seen_at` is write-only) | P3 | Only matters if a future flow re-sets `active` users to `onboarding` |
| P8.6 | Backfill legacy onboarding steps `language/consent/phone_input/otp_pending` | P3 | Audit prod first; data migration + enum cleanup, NOT a runtime override RPC |
| P8.7 | Drop `rejected` role from `permissions.ts` (unreachable) | P3 | Covered by P2.4 documentation effort |
| P8.8 | `case_notes` UI in CaseStudio (table created but never read) | P3 | Adds context for next moderator on same case |
| P8.9 | Watermark for verification docs / view-count display | P3 | Real watermark requires server-side sharp pipeline; CSS overlay is deceptive |
| P8.10 | DecisionPanel template lookup from `admin_reason_templates` table | P3 | Schema-vs-code drift; admin i18n out of scope |

---

## Risks & High-Blast-Radius Notes

- **P1.1 (body bg flip) is gated, not 5-minute.** Touches every page that renders `<body>`. V1 pages `/blocked`, `/onboarding/rejected`, `/onboarding/needs-changes` must self-skin BEFORE flip, or they will inherit V2 paper while still rendering V1 chrome → visually broken. `/legal/[slug]` and `/requests` were verified to self-skin. Sequence: audit-and-patch-3-pages, then flip.
- **P1.5 (root layout) is a structural refactor.** Introducing root `app/layout.tsx` interacts with `[locale]/layout.tsx`'s `<html lang>`. Fragment approach (root renders html, `[locale]` becomes fragment) is safer than nested html. Test all 4 routes (`/`, `/ru/main`, `/uz/main`, `/admin`, `/open-in-telegram`) after change. Geist subsets must include `cyrillic`.
- **P2.1 (pending_ban) seems safe but changes runtime behavior.** Users currently in `pending_ban` (zero today since ban UI is broken, but check prod) will get redirected to `/blocked` immediately on next request. Run audit query first: `SELECT count(*) FROM users WHERE lifecycle_state = 'pending_ban'`.
- **P4.2 (notify→outbox swap) is delivery-critical.** Test fanout under simulated TG outage. Verify chat-message throttle still works (do NOT enqueue throttled events). Verify admin ban notification still bilingual.
- **P7.1 (outbox claim) requires migration + worker change to land together.** Migration alone is safe (adds columns); worker alone is broken (calls nonexistent RPC). Use atomic deploy with migration-first ordering.
- **P7.2 (`process_interest` bilateral guard) touches core matching path.** Run on staging first. Verify existing happy-path interest sends still succeed; verify the new `*_not_eligible` codes surface correctly in client error toasts.
- **P5.1 (two-person ban UI) is L-effort and depends on locating where the current ban entry point lives** (probably ClientCard Moderation tab; `user-actions.tsx` was deleted). May need preceding discovery task. Without this, permanent bans cannot be performed via admin panel today — this is the highest-priority moderation gap.

---

## Findings Closed by Prior Work (Already Done)

The admin redesign (commits `ae0d46c`, `35da009`, `66559be`, A, B1, B2) already closed these audit findings — no action needed:

| Audit finding | Why closed |
|---------------|-----------|
| `OpsSidebar links to 12 admin routes that do not exist` | OpsSidebar reduced to 7 items, all live routes |
| `Two parallel admin shells (V2AdminShell vs OpsShell)` | V2AdminShell and V1 AdminShell deleted; all admin pages use OpsShell |
| `/admin/analytics использует V1 AdminShell + baxt-coral` | Now uses OpsShell, no baxt-coral |
| `/admin/analytics: единственный admin-экран, не мигрировавший на V2AdminShell` | Migrated to OpsShell |
| `Photo moderation: нет проверки owner-scope ... бинарный approve/reject без reason` | PhotoDrawer has `reasonTemplates` + `drawerMode='reject'` |
| `Photo decision UI не запрашивает reason` | Closed by PhotoDrawer |
| `Verification queue: нет multi-admin claim/lock` | `verification_cases.claimed_at` + `admin_claim_verification` RPC in place |
| `Hard-coded #b8475e (rose accent) в admin UI` | Grep returns zero hits |
| `Login: rgba(180,...)` color leak | Grep returns zero hits |
| `Moderator role видит /admin (dashboard) с метриками населения` | Likely handled by OpsShell role gating — re-verify if a moderator role exists |

Total: **9 of 15 admin findings already closed**, leaving 6 live admin items split across P5 (4 work tasks) and P8 (2 tracked deferrals: case_notes UI, reason_templates table lookup).

---

## Open Questions for Founder

1. **Two-person ban discovery (P5.1):** where does the current "Заблокировать" button live now? Grep found nothing in `admin/clients/[id]` or admin-ops. If the UI was entirely removed (not just relocated), P5.1 effort increases — need to build from scratch + locate insertion point.
2. **Moderator role still exists?** Permissions.ts has `'moderator' | 'superadmin'`. If team is solo-superadmin pre-launch, several admin findings (`Moderator role видит /admin dashboard`, priority/age MetricCards in dashboard) lose urgency.
3. **`pending_ban` users in prod today?** Run `SELECT count(*) FROM users WHERE lifecycle_state = 'pending_ban'` before shipping P2.1 — they will be force-redirected to `/blocked`.

---

# Summary

- **Total tasks: 41** across 8 phases (Phase 8 is deferred-tech-debt tracking)
- **Phase task counts:** Phase 1: 7 · Phase 2: 4 · Phase 3: 5 · Phase 4: 3 · Phase 5: 4 · Phase 6: 5 · Phase 7: 3 · Phase 8: 10 (tracked, not actively planned)
- **9 of 15 admin-panel findings already closed** by the recent admin-redesign sweep
- **2 genuine non-cosmetic P1s:** `pending_ban` runtime crash (P2.1) + entry-flow editorial rewrite (P1.3 + P1.4)
- **Quick wins to ship inside Phase 1:** city localization in ProgressiveProfile (P3.1) and diag-banner removal (P1.4 partial)
- **Highest-risk task:** P5.1 (two-person ban UI) — L-effort, requires discovery, blocks all permanent bans today
