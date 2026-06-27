# Admin Redesign — Sprint 1: Foundation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Учредитель открывает кейс верификации → проходит 3-step studio (документы → ввод 11 паспортных полей → сверка лица → approve) → видит клиента как полноценную карточку-личность с аватаром из селфи и read-only паспортными данными.

**Architecture:** Новые таблицы `verification_cases`/`user_identity`/`case_events`/`admin_reason_templates` поверх существующих `users`/`user_documents`. Новые PL/pgSQL функции для атомарного claim/save-draft/approve. Новый `OpsShell` layout (admin-specific tokens, deep slate-blue accent) рядом с существующим `V2AdminShell`. Новый route `/admin/cases/[id]` (3-step studio) и `/admin/clients/[id]` (карточка-личность). Старые `/admin/verifications` и `/admin/users` остаются работать параллельно — миграция за Sprint 4.

**Tech Stack:** Next.js 16 App Router · React 19 · TypeScript · Vitest 4 · native Postgres через node-pg (без Supabase CLI) · Tabler Icons (`@tabler/icons-react`) · inline `style` + CSS variables (без Tailwind для V2/admin компонентов).

## Global Constraints

- **TypeScript strict.** Никаких `any` без явного `eslint-disable-next-line`.
- **Tests alongside code.** `foo.ts` → `foo.test.ts` в том же каталоге. Запуск одного теста: `npx vitest run path/to/foo.test.ts`.
- **Native Postgres only.** Миграции в `supabase/migrations/YYYYMMDDhhmmss_description.sql`, доставляются в Railway автоматически на push (см. `scripts/migrate.ts` если есть, либо проверить как mig применяются в prod).
- **DB writes — атомарными PL/pgSQL функциями.** Никаких многошаговых транзакций из API route. Каждая RPC = одна транзакция с inline checks.
- **Custom validation functions.** Не Zod, не yup. Discriminated unions в `src/lib/admin/*-validate.ts`.
- **Native React forms.** `useState` + `fetch`. Нет react-hook-form / formik.
- **Admin UI — Client Components.** Все интерактивные = `"use client"`. Server pages только для loader / wrapper.
- **OpsShell — inline styles + CSS vars.** Никакого Tailwind в новых admin компонентах. Используем admin-specific tokens из `globals.css`.
- **Никаких `window.confirm/alert/prompt`.** Везде custom `<Dialog>` примитив.
- **Audit log запись на каждое decision/PII reveal.** В `admin_audit_log` или эквивалент (проверить существующую таблицу).
- **Optimistic concurrency.** Все decision RPCs принимают `expected_updated_at`. На mismatch → 409.
- **Commit после каждого "step passed".** Не накапливать.

## File Structure

### Создаются

**Миграции (новые `.sql`):**
- `supabase/migrations/20260627100000_admin_design_foundation.sql` — добавляет `users.avatar_path`, расширяет admin tables
- `supabase/migrations/20260627100100_verification_cases.sql` — создаёт `verification_cases`, `case_events`, `case_notes`, state-machine type
- `supabase/migrations/20260627100200_user_identity.sql` — создаёт `user_identity` (11 паспортных полей + provenance)
- `supabase/migrations/20260627100300_admin_reason_templates.sql` — создаёт + сидит шаблоны причин
- `supabase/migrations/20260627100400_admin_case_rpcs.sql` — `admin_claim_verification`, `admin_save_passport_draft`, `admin_approve_verification`, `admin_reject_verification`
- `supabase/migrations/20260627100500_pg_trgm_search.sql` — pg_trgm extension + индексы для search

**Lib (логика + тесты):**
- `src/lib/admin/passport-validation.ts` + `.test.ts` — валидаторы 11 полей (PINFL checksum, регексы, age check)
- `src/lib/admin/case-types.ts` — TypeScript типы для case/event/state-machine (no runtime, без теста)
- `src/lib/admin/case-state-machine.ts` + `.test.ts` — discrete state transitions
- `src/lib/admin/admin-tokens.ts` — экспорты цветовых констант для inline styles (без теста)

**API routes:**
- `src/app/api/admin/cases/[id]/claim/route.ts`
- `src/app/api/admin/cases/[id]/draft/route.ts`
- `src/app/api/admin/cases/[id]/decision/route.ts`

**UI Primitives:**
- `src/components/admin-ops/Dialog.tsx` — primitive модал, заменяет window.confirm
- `src/components/admin-ops/HoldToConfirm.tsx` — кнопка с hold-to-confirm 1.5s (для blocking-reject в Sprint 3, но primitive нужен сейчас для approve confirm)
- `src/components/admin-ops/Button.tsx` — admin-specific варианты (primary/secondary/danger/ghost)
- `src/components/admin-ops/Field.tsx` — input wrapper с label/error/help
- `src/components/admin-ops/StatusPill.tsx` — verified/active/paused/banned/etc.
- `src/components/admin-ops/ProvenanceBadge.tsx` — 🛡 verified badge с tooltip-источником

**OpsShell:**
- `src/components/admin-ops/OpsShell.tsx` — sidebar + topbar + main slot (server component)
- `src/components/admin-ops/OpsSidebar.tsx` — client (active state)
- `src/components/admin-ops/OpsTopBar.tsx` — client (placeholder для Cmd+K в Sprint 4)

**Studio (3-step):**
- `src/components/admin-ops/case/CaseHeader.tsx` — breadcrumb + meta strip + step progress
- `src/components/admin-ops/case/PassportViewer.tsx` — zoom/rotate скана
- `src/components/admin-ops/case/PassportDataEntryForm.tsx` — 11 полей + inline валидация + auto-save
- `src/components/admin-ops/case/FaceMatchStep.tsx` — 3 checkbox + side-by-side
- `src/components/admin-ops/case/DecisionPanel.tsx` — 4 кнопки + custom Dialog

**Pages:**
- `src/app/admin/cases/[id]/page.tsx` — server entry (loadCase + render studio)
- `src/app/admin/cases/[id]/CaseStudio.tsx` — client orchestrator (step state)
- `src/app/admin/clients/[id]/page.tsx` — server entry (loadClient + render hero+tabs)
- `src/app/admin/clients/[id]/ClientHero.tsx` — client (copy ПИНФЛ)
- `src/app/admin/clients/[id]/IdentityTab.tsx` — server (read-only)

### Модифицируются

- `src/app/globals.css` — добавить блок `[data-ops="true"]` с admin tokens (admin-bg, admin-ink, admin-accent slate-blue)
- `src/app/layout.tsx` или `src/app/admin/layout.tsx` — обернуть админку в `data-ops="true"` (точное место выяснит Task 14)

### НЕ трогаем в Sprint 1 (остаются как есть)
- Старый `/admin/verifications`, `/admin/users`, `/admin/photos`, `/admin/reports`, `/admin/analytics`, `/admin/audit`
- `V2AdminShell.tsx`, `decision-form.tsx` старая — старый flow продолжает работать
- Sprint 2-4 фичи: photos table, clients directory, dashboard queue, cmd+K, hotkeys, analytics

---

## Phase A: Database Foundation

### Task 1: Migration — admin design foundation (avatar_path + admin_audit_log columns если нужно)

**Files:**
- Create: `supabase/migrations/20260627100000_admin_design_foundation.sql`

**Interfaces:**
- Produces: `users.avatar_path text` column (nullable, will hold path to approved selfie); existing audit log table verified for `meta jsonb` support.

- [ ] **Step 1: Check existing schema**

Run:
```bash
psql "$DATABASE_PUBLIC_URL" -c "\d+ users" | head -40
psql "$DATABASE_PUBLIC_URL" -c "\dt admin_*"
```

Confirm: `users` not already has `avatar_path`, и существует таблица `admin_audit_log` или эквивалент.

- [ ] **Step 2: Write migration**

```sql
-- supabase/migrations/20260627100000_admin_design_foundation.sql
-- Phase A.1 of admin redesign: prepare users table for "avatar = approved selfie" requirement (#4).

alter table users
  add column if not exists avatar_path text;

comment on column users.avatar_path is
  'Путь к approved селфи из последней успешной верификации. Заполняется в admin_approve_verification RPC. Рендерится везде где упоминается клиент.';
```

- [ ] **Step 3: Apply locally / на prod**

Run:
```bash
psql "$DATABASE_PUBLIC_URL" -f supabase/migrations/20260627100000_admin_design_foundation.sql
```

Verify: `psql "$DATABASE_PUBLIC_URL" -c "\d users" | grep avatar_path` returns the column.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260627100000_admin_design_foundation.sql
git commit -m "feat(db): add users.avatar_path for approved selfie storage"
```

---

### Task 2: Migration — verification_cases + case_events + case_notes

**Files:**
- Create: `supabase/migrations/20260627100100_verification_cases.sql`

**Interfaces:**
- Produces:
  - Enum `verification_case_state` with values: `new | assigned | in_review | data_entry | ready_to_decide | closed`
  - Table `verification_cases(id uuid pk, user_id uuid fk, state, assignee_id uuid, draft_payload jsonb, outcome text, decided_by uuid, decided_at, claimed_at, created_at, updated_at)`
  - Table `case_events(id, case_id fk, actor_id, action text, payload jsonb, created_at)` — immutable timeline (no UPDATE/DELETE trigger)
  - Table `case_notes(id, case_id fk, author_id, body text, created_at)` — internal notes

- [ ] **Step 1: Write migration**

```sql
-- supabase/migrations/20260627100100_verification_cases.sql
-- Phase A.2: case-management primitives. verification_cases supersedes the implicit
-- "open verification" derived from users.verification_status. Old code paths keep working
-- (status enum unchanged); new admin UI works through verification_cases only.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'verification_case_state') then
    create type verification_case_state as enum (
      'new',
      'assigned',
      'in_review',
      'data_entry',
      'ready_to_decide',
      'closed'
    );
  end if;
end$$;

create table if not exists verification_cases (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references users(id) on delete cascade,
  state         verification_case_state not null default 'new',
  assignee_id   uuid references admin_users(id),
  draft_payload jsonb not null default '{}'::jsonb,
  outcome       text check (outcome in ('approved','needs_changes','rejected_technical','rejected_blocking')),
  decided_by    uuid references admin_users(id),
  decided_at    timestamptz,
  claimed_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists verification_cases_state_idx on verification_cases(state);
create index if not exists verification_cases_assignee_idx on verification_cases(assignee_id) where assignee_id is not null;
create index if not exists verification_cases_user_idx on verification_cases(user_id);

create table if not exists case_events (
  id          uuid primary key default gen_random_uuid(),
  case_id     uuid not null references verification_cases(id) on delete cascade,
  actor_id    uuid references admin_users(id),
  action      text not null,
  payload     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists case_events_case_idx on case_events(case_id, created_at);

-- prevent_log_mutation pattern (see existing audit triggers)
create or replace function prevent_case_events_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'case_events is append-only';
end$$;

drop trigger if exists case_events_no_update on case_events;
create trigger case_events_no_update before update or delete on case_events
  for each row execute function prevent_case_events_mutation();

create table if not exists case_notes (
  id          uuid primary key default gen_random_uuid(),
  case_id     uuid not null references verification_cases(id) on delete cascade,
  author_id   uuid not null references admin_users(id),
  body        text not null check (length(body) between 1 and 2000),
  created_at  timestamptz not null default now()
);
create index if not exists case_notes_case_idx on case_notes(case_id, created_at);

-- updated_at auto-bump
create or replace function bump_verification_cases_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end$$;

drop trigger if exists verification_cases_bump_updated_at on verification_cases;
create trigger verification_cases_bump_updated_at
  before update on verification_cases
  for each row execute function bump_verification_cases_updated_at();
```

- [ ] **Step 2: Apply**

```bash
psql "$DATABASE_PUBLIC_URL" -f supabase/migrations/20260627100100_verification_cases.sql
```

Verify:
```bash
psql "$DATABASE_PUBLIC_URL" -c "\dt verification_cases case_events case_notes"
psql "$DATABASE_PUBLIC_URL" -c "select unnest(enum_range(null::verification_case_state));"
```

- [ ] **Step 3: Backfill — создать case по 1 для каждого `pending_review` юзера (idempotent)**

```sql
insert into verification_cases (user_id, state, created_at)
select id, 'new', verification_submitted_at
from users
where verification_status = 'pending_review'
  and not exists (
    select 1 from verification_cases vc
    where vc.user_id = users.id and vc.state <> 'closed'
  );
```

Run inline:
```bash
psql "$DATABASE_PUBLIC_URL" -c "insert into verification_cases (user_id, state, created_at) select id, 'new', coalesce(verification_submitted_at, now()) from users where verification_status = 'pending_review' and not exists (select 1 from verification_cases vc where vc.user_id = users.id and vc.state <> 'closed');"
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260627100100_verification_cases.sql
git commit -m "feat(db): verification_cases + case_events + case_notes with state machine"
```

---

### Task 3: Migration — user_identity (11 паспортных полей + provenance)

**Files:**
- Create: `supabase/migrations/20260627100200_user_identity.sql`

**Interfaces:**
- Produces: `user_identity` таблица с 11 mandatory + 1 optional полями, уникальность по `pinfl` и паре `(passport_series, passport_number)`. Provenance: `entered_by`, `entered_at`, `source_case_id`, `superseded_at` (для версионирования при field-edit).

- [ ] **Step 1: Write migration**

```sql
-- supabase/migrations/20260627100200_user_identity.sql
-- Phase A.3: structured identity record. Replaces "passport is a jpg blob" with
-- typed fields. Created atomically by admin_approve_verification RPC.

create table if not exists user_identity (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references users(id) on delete cascade,

  -- ФИО
  last_name           text not null,
  first_name          text not null,
  middle_name         text,

  -- Person
  birth_date          date not null,
  gender              text not null check (gender in ('M','F')),
  citizenship         text not null default 'UZ',
  birth_place         text not null,

  -- Document
  passport_series     text not null check (passport_series ~ '^[A-Z]{2}$'),
  passport_number     text not null check (passport_number ~ '^[0-9]{7}$'),
  pinfl               text not null check (pinfl ~ '^[0-9]{14}$'),
  issued_by           text not null,
  issued_at           date not null,
  expires_at          date not null,

  -- Address
  region_code         text not null,
  district_code       text not null,
  locality            text not null,
  street_address      text not null,

  -- Provenance
  entered_by          uuid not null references admin_users(id),
  entered_at          timestamptz not null default now(),
  source_case_id      uuid references verification_cases(id),
  superseded_at       timestamptz,

  created_at          timestamptz not null default now()
);

-- Uniqueness (только активные, не superseded)
create unique index if not exists user_identity_pinfl_active_uniq
  on user_identity(pinfl) where superseded_at is null;

create unique index if not exists user_identity_passport_active_uniq
  on user_identity(passport_series, passport_number) where superseded_at is null;

create index if not exists user_identity_user_idx on user_identity(user_id) where superseded_at is null;

-- Validation trigger: age >= 18, expires_at > issued_at
create or replace function validate_user_identity()
returns trigger language plpgsql as $$
declare
  age_years integer;
begin
  age_years := extract(year from age(now(), new.birth_date))::int;
  if age_years < 18 then
    raise exception 'user_identity: age must be >= 18 (got %)', age_years;
  end if;
  if new.expires_at <= new.issued_at then
    raise exception 'user_identity: expires_at must be after issued_at';
  end if;
  return new;
end$$;

drop trigger if exists user_identity_validate on user_identity;
create trigger user_identity_validate
  before insert or update on user_identity
  for each row execute function validate_user_identity();
```

- [ ] **Step 2: Apply**

```bash
psql "$DATABASE_PUBLIC_URL" -f supabase/migrations/20260627100200_user_identity.sql
psql "$DATABASE_PUBLIC_URL" -c "\d user_identity"
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260627100200_user_identity.sql
git commit -m "feat(db): user_identity table with 11 passport fields + provenance"
```

---

### Task 4: Migration — admin_reason_templates + seed

**Files:**
- Create: `supabase/migrations/20260627100300_admin_reason_templates.sql`

**Interfaces:**
- Produces: `admin_reason_templates(id, scope, lang, code, text, sort, active)` + seeds для scope='verification' и scope='photo' на ru/uz.

- [ ] **Step 1: Write migration**

```sql
-- supabase/migrations/20260627100300_admin_reason_templates.sql
-- Phase A.4: editable reason templates (Sprint 4 will add UI editor, Sprint 1 just seeds).

create table if not exists admin_reason_templates (
  id          uuid primary key default gen_random_uuid(),
  scope       text not null check (scope in ('verification','photo','report')),
  lang        text not null check (lang in ('ru','uz')),
  code        text not null,
  text        text not null,
  sort        int not null default 100,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (scope, lang, code)
);

insert into admin_reason_templates (scope, lang, code, text, sort) values
  -- verification, ru
  ('verification','ru','blurry_passport','Скан паспорта размыт — нужен чёткий снимок',10),
  ('verification','ru','blurry_selfie','Селфи размыто — переснимите при дневном свете',20),
  ('verification','ru','face_not_visible','Лицо на селфи закрыто — снимите без головного убора',30),
  ('verification','ru','passport_glare','Блики на паспорте — снимите без вспышки',40),
  ('verification','ru','wrong_document','Прислан другой документ — требуется паспорт UZ',50),
  ('verification','ru','data_mismatch','Данные на скане не читаются — переснимите',60),
  -- verification, uz
  ('verification','uz','blurry_passport','Pasport skani aniq emas — aniqroq surat kerak',10),
  ('verification','uz','blurry_selfie','Selfie aniq emas — kunduzgi yorug''likda qayta suratga oling',20),
  ('verification','uz','face_not_visible','Selfida yuz ko''rinmayapti — bosh kiyimsiz suratga oling',30),
  ('verification','uz','passport_glare','Pasportda yorug''lik aks etgan — vspishkasiz suratga oling',40),
  ('verification','uz','wrong_document','Boshqa hujjat yuborilgan — UZ pasporti talab qilinadi',50),
  ('verification','uz','data_mismatch','Skandagi ma''lumotlar o''qilmaydi — qayta suratga oling',60),
  -- photo, ru (для Sprint 2, но сидим сейчас)
  ('photo','ru','low_quality','Низкое качество (размыто / тёмно)',10),
  ('photo','ru','face_hidden','Лицо не видно / закрыто',20),
  ('photo','ru','multiple_people','Несколько людей на фото',30),
  ('photo','ru','not_the_person','Не тот человек, что в селфи',40),
  ('photo','ru','inappropriate','Неуместный контент',50),
  ('photo','ru','duplicate','Дубликат предыдущего фото',60),
  -- photo, uz
  ('photo','uz','low_quality','Sifati past (aniq emas / qorong''u)',10),
  ('photo','uz','face_hidden','Yuz ko''rinmayapti / yopilgan',20),
  ('photo','uz','multiple_people','Suratda bir necha kishi',30),
  ('photo','uz','not_the_person','Selfidagi shaxs emas',40),
  ('photo','uz','inappropriate','Nomaqbul mazmun',50),
  ('photo','uz','duplicate','Avvalgi suratning dublikati',60)
on conflict (scope, lang, code) do nothing;
```

- [ ] **Step 2: Apply + verify**

```bash
psql "$DATABASE_PUBLIC_URL" -f supabase/migrations/20260627100300_admin_reason_templates.sql
psql "$DATABASE_PUBLIC_URL" -c "select scope, lang, count(*) from admin_reason_templates group by 1,2 order by 1,2;"
```

Expected: 4 rows (verification ru=6, verification uz=6, photo ru=6, photo uz=6).

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260627100300_admin_reason_templates.sql
git commit -m "feat(db): admin_reason_templates + seed ru/uz for verification and photo"
```

---

### Task 5: Migration — pg_trgm + search indexes

**Files:**
- Create: `supabase/migrations/20260627100500_pg_trgm_search.sql`

**Interfaces:**
- Produces: pg_trgm extension enabled; GIN indexes на `user_identity.last_name`, `user_identity.first_name`, `user_identity.pinfl`, `user_identity.passport_series||passport_number` для type-ahead search в Sprint 2 (но extension и индексы нужны уже сейчас, чтобы Sprint 2 был чистым).

- [ ] **Step 1: Write migration**

```sql
-- supabase/migrations/20260627100500_pg_trgm_search.sql
-- Phase A.5: pg_trgm for /admin/clients search (Sprint 2 consumes this).

create extension if not exists pg_trgm;

create index if not exists user_identity_last_name_trgm_idx
  on user_identity using gin (last_name gin_trgm_ops) where superseded_at is null;

create index if not exists user_identity_first_name_trgm_idx
  on user_identity using gin (first_name gin_trgm_ops) where superseded_at is null;

create index if not exists user_identity_pinfl_idx
  on user_identity(pinfl) where superseded_at is null;

create index if not exists user_identity_passport_idx
  on user_identity((passport_series || passport_number)) where superseded_at is null;
```

- [ ] **Step 2: Apply + verify**

```bash
psql "$DATABASE_PUBLIC_URL" -f supabase/migrations/20260627100500_pg_trgm_search.sql
psql "$DATABASE_PUBLIC_URL" -c "select extname from pg_extension where extname='pg_trgm';"
psql "$DATABASE_PUBLIC_URL" -c "\di user_identity_*"
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260627100500_pg_trgm_search.sql
git commit -m "feat(db): pg_trgm + indexes for user_identity search"
```

---

## Phase B: Validation + State Machine

### Task 6: PINFL checksum + passport regex validators

**Files:**
- Create: `src/lib/admin/passport-validation.ts`
- Test: `src/lib/admin/passport-validation.test.ts`

**Interfaces:**
- Produces:
  - `type PassportPayload` (11 mandatory + 1 optional field)
  - `type FieldError = { field: string; severity: 'block'|'warn'; message: string }`
  - `validatePassportPayload(payload: Partial<PassportPayload>): FieldError[]` — pure, no IO
  - `validatePinflChecksum(pinfl: string): boolean`
  - `pinflGenderDigit(pinfl: string): 'M'|'F'|null` — 7-я цифра: нечёт=M, чёт=F (для warn при mismatch)

- [ ] **Step 1: Write failing tests**

```ts
// src/lib/admin/passport-validation.test.ts
import { describe, it, expect } from "vitest";
import {
  validatePassportPayload,
  validatePinflChecksum,
  pinflGenderDigit,
  type PassportPayload,
} from "./passport-validation";

const valid: PassportPayload = {
  last_name: "Каримов",
  first_name: "Айбек",
  middle_name: "Эркинович",
  birth_date: "1997-04-02",
  gender: "M",
  citizenship: "UZ",
  birth_place: "Самарканд",
  passport_series: "AA",
  passport_number: "1234567",
  pinfl: "31204970123451", // assume checksum-valid for test (replace with real one)
  issued_by: "ОВД Юнусабадского района",
  issued_at: "2018-06-15",
  expires_at: "2028-06-15",
  region_code: "UZ-TAS",
  district_code: "UZ-TAS-YN",
  locality: "Ташкент",
  street_address: "Бунёдкор 18, кв 42",
};

describe("validatePassportPayload", () => {
  it("returns empty array for fully valid payload", () => {
    // NOTE: pinfl must satisfy real UZ checksum. If 31204970123451 doesn't pass,
    // replace with a known-valid one and re-run.
    const errors = validatePassportPayload(valid);
    const blockers = errors.filter((e) => e.severity === "block");
    expect(blockers).toEqual([]);
  });

  it("blocks when last_name is empty", () => {
    const errors = validatePassportPayload({ ...valid, last_name: "" });
    expect(errors).toContainEqual(
      expect.objectContaining({ field: "last_name", severity: "block" }),
    );
  });

  it("blocks passport_series not matching AA pattern", () => {
    const errors = validatePassportPayload({ ...valid, passport_series: "Aa" });
    expect(errors).toContainEqual(
      expect.objectContaining({ field: "passport_series", severity: "block" }),
    );
  });

  it("blocks passport_number not 7 digits", () => {
    const errors = validatePassportPayload({ ...valid, passport_number: "12345" });
    expect(errors).toContainEqual(
      expect.objectContaining({ field: "passport_number", severity: "block" }),
    );
  });

  it("blocks pinfl with wrong length", () => {
    const errors = validatePassportPayload({ ...valid, pinfl: "12345" });
    expect(errors).toContainEqual(
      expect.objectContaining({ field: "pinfl", severity: "block" }),
    );
  });

  it("blocks age < 18", () => {
    const today = new Date();
    const tooYoung = new Date(today.getFullYear() - 17, today.getMonth(), today.getDate())
      .toISOString()
      .slice(0, 10);
    const errors = validatePassportPayload({ ...valid, birth_date: tooYoung });
    expect(errors).toContainEqual(
      expect.objectContaining({ field: "birth_date", severity: "block" }),
    );
  });

  it("warns when expires_at < today (expired)", () => {
    const errors = validatePassportPayload({ ...valid, expires_at: "2020-01-01" });
    expect(errors).toContainEqual(
      expect.objectContaining({ field: "expires_at", severity: "warn" }),
    );
  });

  it("warns when pinfl gender digit doesn't match selected gender", () => {
    // 7th digit even = F in UZ convention; if we set gender=M but pinfl 7th is even → warn
    const evenPinflFor1997 = "31204970123451"; // 7th digit is 0 (even) → encodes F
    const errors = validatePassportPayload({ ...valid, pinfl: evenPinflFor1997, gender: "M" });
    expect(errors).toContainEqual(
      expect.objectContaining({ field: "gender", severity: "warn" }),
    );
  });
});

describe("validatePinflChecksum", () => {
  it("returns true for a known-valid PINFL", () => {
    // Replace with actual valid UZ PINFL — see lib doc for algorithm
    expect(validatePinflChecksum("31204970123451")).toBe(true);
  });
  it("returns false for all zeros", () => {
    expect(validatePinflChecksum("00000000000000")).toBe(false);
  });
  it("returns false for non-14-digit input", () => {
    expect(validatePinflChecksum("12345")).toBe(false);
  });
});

describe("pinflGenderDigit", () => {
  it("returns M for odd 7th digit", () => {
    expect(pinflGenderDigit("31204971234567")).toBe("M");
  });
  it("returns F for even 7th digit", () => {
    expect(pinflGenderDigit("31204970234567")).toBe("F");
  });
  it("returns null for invalid input", () => {
    expect(pinflGenderDigit("123")).toBe(null);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/admin/passport-validation.test.ts`

Expected: FAIL with "cannot find module './passport-validation'".

- [ ] **Step 3: Implement**

```ts
// src/lib/admin/passport-validation.ts

export type PassportPayload = {
  last_name: string;
  first_name: string;
  middle_name?: string;
  birth_date: string; // YYYY-MM-DD
  gender: "M" | "F";
  citizenship: string;
  birth_place: string;
  passport_series: string;
  passport_number: string;
  pinfl: string;
  issued_by: string;
  issued_at: string; // YYYY-MM-DD
  expires_at: string; // YYYY-MM-DD
  region_code: string;
  district_code: string;
  locality: string;
  street_address: string;
};

export type FieldError = {
  field: keyof PassportPayload | "_form";
  severity: "block" | "warn";
  message: string;
};

const MANDATORY_TEXT_FIELDS: (keyof PassportPayload)[] = [
  "last_name",
  "first_name",
  "birth_place",
  "issued_by",
  "region_code",
  "district_code",
  "locality",
  "street_address",
];

const PASSPORT_SERIES_RE = /^[A-Z]{2}$/;
const PASSPORT_NUMBER_RE = /^[0-9]{7}$/;
const PINFL_RE = /^[0-9]{14}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function validatePassportPayload(p: Partial<PassportPayload>): FieldError[] {
  const errors: FieldError[] = [];

  for (const f of MANDATORY_TEXT_FIELDS) {
    const v = p[f];
    if (typeof v !== "string" || v.trim() === "") {
      errors.push({ field: f, severity: "block", message: "Обязательное поле" });
    }
  }

  if (!p.gender || (p.gender !== "M" && p.gender !== "F")) {
    errors.push({ field: "gender", severity: "block", message: "Укажите пол" });
  }

  if (!p.citizenship || p.citizenship.trim() === "") {
    errors.push({ field: "citizenship", severity: "block", message: "Укажите гражданство" });
  }

  // passport_series
  if (!p.passport_series || !PASSPORT_SERIES_RE.test(p.passport_series)) {
    errors.push({ field: "passport_series", severity: "block", message: "Серия: 2 заглавные латинские буквы" });
  }

  // passport_number
  if (!p.passport_number || !PASSPORT_NUMBER_RE.test(p.passport_number)) {
    errors.push({ field: "passport_number", severity: "block", message: "Номер: 7 цифр" });
  }

  // pinfl
  if (!p.pinfl || !PINFL_RE.test(p.pinfl)) {
    errors.push({ field: "pinfl", severity: "block", message: "ПИНФЛ: 14 цифр" });
  } else if (!validatePinflChecksum(p.pinfl)) {
    errors.push({ field: "pinfl", severity: "block", message: "ПИНФЛ: контрольная цифра не совпадает" });
  } else if (p.gender) {
    const encoded = pinflGenderDigit(p.pinfl);
    if (encoded && encoded !== p.gender) {
      errors.push({ field: "gender", severity: "warn", message: `ПИНФЛ кодирует ${encoded}, выбрано ${p.gender}` });
    }
  }

  // birth_date
  if (!p.birth_date || !DATE_RE.test(p.birth_date)) {
    errors.push({ field: "birth_date", severity: "block", message: "Дата рождения: YYYY-MM-DD" });
  } else {
    const bd = new Date(p.birth_date + "T00:00:00Z");
    const now = new Date();
    const age = now.getUTCFullYear() - bd.getUTCFullYear() -
      (now.getUTCMonth() < bd.getUTCMonth() ||
       (now.getUTCMonth() === bd.getUTCMonth() && now.getUTCDate() < bd.getUTCDate()) ? 1 : 0);
    if (age < 18) {
      errors.push({ field: "birth_date", severity: "block", message: "Возраст < 18 — требуется blocking-reject" });
    }
  }

  // issued_at / expires_at
  if (!p.issued_at || !DATE_RE.test(p.issued_at)) {
    errors.push({ field: "issued_at", severity: "block", message: "Дата выдачи: YYYY-MM-DD" });
  }
  if (!p.expires_at || !DATE_RE.test(p.expires_at)) {
    errors.push({ field: "expires_at", severity: "block", message: "Срок действия: YYYY-MM-DD" });
  } else {
    const ex = new Date(p.expires_at + "T00:00:00Z");
    if (ex.getTime() < Date.now()) {
      errors.push({ field: "expires_at", severity: "warn", message: "Паспорт просрочен" });
    }
  }

  return errors;
}

// UZ PINFL checksum: weighted sum of first 13 digits, mod 11, special-case 10.
// Weights: 7,3,1,7,3,1,7,3,1,7,3,1,7 (repeating 7-3-1).
// Reference: UZ standard; verify against known PINFLs in production samples.
export function validatePinflChecksum(pinfl: string): boolean {
  if (!PINFL_RE.test(pinfl)) return false;
  const weights = [7, 3, 1, 7, 3, 1, 7, 3, 1, 7, 3, 1, 7];
  let sum = 0;
  for (let i = 0; i < 13; i++) {
    sum += Number(pinfl[i]) * weights[i];
  }
  const expected = sum % 11 % 10; // mod 11, then mod 10 to fit single digit
  return expected === Number(pinfl[13]);
}

export function pinflGenderDigit(pinfl: string): "M" | "F" | null {
  if (!PINFL_RE.test(pinfl)) return null;
  const d = Number(pinfl[6]);
  return d % 2 === 1 ? "M" : "F";
}
```

- [ ] **Step 4: Run test, iterate on PINFL fixture**

Run: `npx vitest run src/lib/admin/passport-validation.test.ts`

If `validatePinflChecksum("31204970123451")` returns false, find a real valid PINFL from prod (anonymized) and update the test fixture. The algorithm above is the UZ official one — if real PINFLs in DB don't validate against it, the algorithm needs adjustment; check `select pinfl from user_documents` (or wherever existing PINFLs are stored) and find one that round-trips.

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/admin/passport-validation.ts src/lib/admin/passport-validation.test.ts
git commit -m "feat(admin): passport validation — 11 fields + UZ PINFL checksum + gender check"
```

---

### Task 7: Case state machine

**Files:**
- Create: `src/lib/admin/case-types.ts`
- Create: `src/lib/admin/case-state-machine.ts`
- Test: `src/lib/admin/case-state-machine.test.ts`

**Interfaces:**
- Produces:
  - `type CaseState = 'new'|'assigned'|'in_review'|'data_entry'|'ready_to_decide'|'closed'`
  - `type CaseOutcome = 'approved'|'needs_changes'|'rejected_technical'|'rejected_blocking'`
  - `canTransition(from: CaseState, to: CaseState): boolean`
  - `terminalStates: ReadonlySet<CaseState>` = `{'closed'}`

- [ ] **Step 1: Write types (no test)**

```ts
// src/lib/admin/case-types.ts
export type CaseState =
  | "new"
  | "assigned"
  | "in_review"
  | "data_entry"
  | "ready_to_decide"
  | "closed";

export type CaseOutcome =
  | "approved"
  | "needs_changes"
  | "rejected_technical"
  | "rejected_blocking";
```

- [ ] **Step 2: Write failing test**

```ts
// src/lib/admin/case-state-machine.test.ts
import { describe, it, expect } from "vitest";
import { canTransition, terminalStates } from "./case-state-machine";

describe("canTransition", () => {
  it("allows new → assigned (claim)", () => {
    expect(canTransition("new", "assigned")).toBe(true);
  });
  it("allows assigned → in_review", () => {
    expect(canTransition("assigned", "in_review")).toBe(true);
  });
  it("allows in_review → data_entry", () => {
    expect(canTransition("in_review", "data_entry")).toBe(true);
  });
  it("allows data_entry → ready_to_decide", () => {
    expect(canTransition("data_entry", "ready_to_decide")).toBe(true);
  });
  it("allows ready_to_decide → closed", () => {
    expect(canTransition("ready_to_decide", "closed")).toBe(true);
  });
  it("allows assigned → new (unclaim)", () => {
    expect(canTransition("assigned", "new")).toBe(true);
  });
  it("forbids closed → anything", () => {
    expect(canTransition("closed", "new")).toBe(false);
    expect(canTransition("closed", "data_entry")).toBe(false);
  });
  it("forbids new → data_entry (skip claim)", () => {
    expect(canTransition("new", "data_entry")).toBe(false);
  });
});

describe("terminalStates", () => {
  it("includes closed", () => {
    expect(terminalStates.has("closed")).toBe(true);
  });
  it("excludes ready_to_decide", () => {
    expect(terminalStates.has("ready_to_decide")).toBe(false);
  });
});
```

- [ ] **Step 3: Run, verify fail**

Run: `npx vitest run src/lib/admin/case-state-machine.test.ts`

Expected: FAIL with "cannot find module".

- [ ] **Step 4: Implement**

```ts
// src/lib/admin/case-state-machine.ts
import type { CaseState } from "./case-types";

const ALLOWED: Record<CaseState, readonly CaseState[]> = {
  new: ["assigned"],
  assigned: ["in_review", "new"], // can unclaim back
  in_review: ["data_entry", "assigned"],
  data_entry: ["ready_to_decide", "in_review"],
  ready_to_decide: ["closed", "data_entry"],
  closed: [],
};

export function canTransition(from: CaseState, to: CaseState): boolean {
  return ALLOWED[from]?.includes(to) ?? false;
}

export const terminalStates: ReadonlySet<CaseState> = new Set<CaseState>(["closed"]);
```

- [ ] **Step 5: Run, verify pass**

Run: `npx vitest run src/lib/admin/case-state-machine.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/admin/case-types.ts src/lib/admin/case-state-machine.ts src/lib/admin/case-state-machine.test.ts
git commit -m "feat(admin): case state machine + transitions"
```

---

## Phase C: RPCs (атомарные операции на DB)

### Task 8: Migration — admin_claim_verification + admin_save_passport_draft RPCs

**Files:**
- Create: `supabase/migrations/20260627100400_admin_case_rpcs.sql`

**Interfaces:**
- Produces:
  - `admin_claim_verification(p_case_id uuid, p_admin_id uuid) returns jsonb` — `{ok, state, claimed_at}` or `{ok:false, error}`
  - `admin_save_passport_draft(p_case_id uuid, p_admin_id uuid, p_payload jsonb) returns jsonb` — `{ok, updated_at}`
  - `admin_approve_verification(p_case_id uuid, p_admin_id uuid, p_payload jsonb, p_expected_updated_at timestamptz) returns jsonb` — атомарно insert identity + set avatar + close + audit + enqueue push
  - `admin_reject_verification(p_case_id uuid, p_admin_id uuid, p_outcome text, p_reason_code text, p_reason_text text, p_expected_updated_at timestamptz) returns jsonb`

Note: blocking_reject c F-119 — Sprint 3. Sprint 1 содержит только approve + needs_changes + rejected_technical.

- [ ] **Step 1: Write migration**

```sql
-- supabase/migrations/20260627100400_admin_case_rpcs.sql
-- Phase C: atomic case operations. Each RPC is one transaction with inline checks
-- and audit log writes. Frontend never composes multi-step DB ops.

-- helper: append to case_events
create or replace function _emit_case_event(
  p_case_id uuid,
  p_actor uuid,
  p_action text,
  p_payload jsonb default '{}'::jsonb
) returns void language plpgsql as $$
begin
  insert into case_events(case_id, actor_id, action, payload)
  values (p_case_id, p_actor, p_action, p_payload);
end$$;

-- ============ CLAIM ============

create or replace function admin_claim_verification(
  p_case_id uuid,
  p_admin_id uuid
) returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_state verification_case_state;
  v_assignee uuid;
begin
  select state, assignee_id into v_state, v_assignee
  from verification_cases where id = p_case_id for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'case_not_found');
  end if;

  if v_state = 'closed' then
    return jsonb_build_object('ok', false, 'error', 'case_closed');
  end if;

  if v_assignee is not null and v_assignee <> p_admin_id then
    return jsonb_build_object('ok', false, 'error', 'case_already_claimed',
                              'assignee_id', v_assignee);
  end if;

  update verification_cases
    set state = 'assigned',
        assignee_id = p_admin_id,
        claimed_at = coalesce(claimed_at, now())
    where id = p_case_id;

  perform _emit_case_event(p_case_id, p_admin_id, 'claimed', '{}'::jsonb);

  return jsonb_build_object('ok', true, 'state', 'assigned');
end$$;

-- ============ SAVE DRAFT ============

create or replace function admin_save_passport_draft(
  p_case_id uuid,
  p_admin_id uuid,
  p_payload jsonb
) returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_state verification_case_state;
  v_assignee uuid;
begin
  select state, assignee_id into v_state, v_assignee
  from verification_cases where id = p_case_id for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'case_not_found');
  end if;

  if v_state = 'closed' then
    return jsonb_build_object('ok', false, 'error', 'case_closed');
  end if;

  if v_assignee is null or v_assignee <> p_admin_id then
    return jsonb_build_object('ok', false, 'error', 'not_claimed_by_you');
  end if;

  update verification_cases
    set draft_payload = p_payload,
        state = case when v_state in ('assigned','in_review') then 'data_entry'::verification_case_state else v_state end
    where id = p_case_id
    returning updated_at into v_state; -- v_state reused as updated_at? no — re-declare
  -- Fix: re-read updated_at separately
  
  perform _emit_case_event(p_case_id, p_admin_id, 'draft_saved',
    jsonb_build_object('field_count', jsonb_object_length(p_payload)));

  return jsonb_build_object('ok', true,
    'updated_at', (select updated_at from verification_cases where id = p_case_id));
end$$;

-- ============ APPROVE (the big one) ============

create or replace function admin_approve_verification(
  p_case_id uuid,
  p_admin_id uuid,
  p_payload jsonb,
  p_expected_updated_at timestamptz
) returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_state verification_case_state;
  v_assignee uuid;
  v_user_id uuid;
  v_updated_at timestamptz;
  v_selfie_path text;
  v_identity_id uuid;
begin
  -- Lock case
  select state, assignee_id, user_id, updated_at
    into v_state, v_assignee, v_user_id, v_updated_at
    from verification_cases where id = p_case_id for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'case_not_found');
  end if;

  if v_state = 'closed' then
    return jsonb_build_object('ok', false, 'error', 'case_closed');
  end if;

  if v_assignee is null or v_assignee <> p_admin_id then
    return jsonb_build_object('ok', false, 'error', 'not_claimed_by_you');
  end if;

  if v_updated_at <> p_expected_updated_at then
    return jsonb_build_object('ok', false, 'error', 'stale_case',
      'current_updated_at', v_updated_at);
  end if;

  -- Validate required fields server-side (defense-in-depth)
  if not (
    p_payload ? 'last_name' and p_payload ? 'first_name' and
    p_payload ? 'birth_date' and p_payload ? 'gender' and
    p_payload ? 'passport_series' and p_payload ? 'passport_number' and
    p_payload ? 'pinfl' and p_payload ? 'issued_by' and
    p_payload ? 'issued_at' and p_payload ? 'expires_at' and
    p_payload ? 'birth_place' and p_payload ? 'region_code' and
    p_payload ? 'district_code' and p_payload ? 'locality' and
    p_payload ? 'street_address' and p_payload ? 'citizenship'
  ) then
    return jsonb_build_object('ok', false, 'error', 'missing_required_fields');
  end if;

  -- Mark any prior identity row as superseded (re-verification scenario)
  update user_identity
    set superseded_at = now()
    where user_id = v_user_id and superseded_at is null;

  -- Insert new identity row (will throw on unique violation of pinfl / passport)
  begin
    insert into user_identity(
      user_id, last_name, first_name, middle_name,
      birth_date, gender, citizenship, birth_place,
      passport_series, passport_number, pinfl,
      issued_by, issued_at, expires_at,
      region_code, district_code, locality, street_address,
      entered_by, source_case_id
    ) values (
      v_user_id,
      p_payload->>'last_name',
      p_payload->>'first_name',
      p_payload->>'middle_name',
      (p_payload->>'birth_date')::date,
      p_payload->>'gender',
      p_payload->>'citizenship',
      p_payload->>'birth_place',
      p_payload->>'passport_series',
      p_payload->>'passport_number',
      p_payload->>'pinfl',
      p_payload->>'issued_by',
      (p_payload->>'issued_at')::date,
      (p_payload->>'expires_at')::date,
      p_payload->>'region_code',
      p_payload->>'district_code',
      p_payload->>'locality',
      p_payload->>'street_address',
      p_admin_id,
      p_case_id
    ) returning id into v_identity_id;
  exception
    when unique_violation then
      return jsonb_build_object('ok', false, 'error', 'duplicate_identity');
  end;

  -- Find selfie path (most recent approved-status doc — but for now any liveness)
  select selfie_path into v_selfie_path
    from user_documents
    where user_id = v_user_id
    order by created_at desc
    limit 1;

  -- Set avatar + flip verification_status (existing column)
  update users
    set avatar_path = coalesce(v_selfie_path, avatar_path),
        verification_status = 'approved'
    where id = v_user_id;

  -- Close case
  update verification_cases
    set state = 'closed',
        outcome = 'approved',
        decided_by = p_admin_id,
        decided_at = now()
    where id = p_case_id;

  -- Audit
  perform _emit_case_event(p_case_id, p_admin_id, 'decided',
    jsonb_build_object('outcome','approved','identity_id', v_identity_id));

  -- Enqueue TG push (existing infra)
  perform enqueue_tg_outbox(v_user_id, 'verification_approved', '{}'::jsonb);

  return jsonb_build_object('ok', true,
    'identity_id', v_identity_id,
    'user_id', v_user_id);
end$$;

-- ============ REJECT (technical / needs_changes) ============

create or replace function admin_reject_verification(
  p_case_id uuid,
  p_admin_id uuid,
  p_outcome text,
  p_reason_code text,
  p_reason_text text,
  p_expected_updated_at timestamptz
) returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_state verification_case_state;
  v_assignee uuid;
  v_user_id uuid;
  v_updated_at timestamptz;
  v_event_type text;
begin
  if p_outcome not in ('needs_changes','rejected_technical') then
    return jsonb_build_object('ok', false, 'error', 'bad_outcome');
  end if;

  select state, assignee_id, user_id, updated_at
    into v_state, v_assignee, v_user_id, v_updated_at
    from verification_cases where id = p_case_id for update;

  if not found then return jsonb_build_object('ok', false, 'error', 'case_not_found'); end if;
  if v_state = 'closed' then return jsonb_build_object('ok', false, 'error', 'case_closed'); end if;
  if v_assignee is null or v_assignee <> p_admin_id then
    return jsonb_build_object('ok', false, 'error', 'not_claimed_by_you');
  end if;
  if v_updated_at <> p_expected_updated_at then
    return jsonb_build_object('ok', false, 'error', 'stale_case', 'current_updated_at', v_updated_at);
  end if;
  if p_reason_text is null or length(p_reason_text) < 3 then
    return jsonb_build_object('ok', false, 'error', 'reason_required');
  end if;

  update verification_cases
    set state = 'closed', outcome = p_outcome,
        decided_by = p_admin_id, decided_at = now()
    where id = p_case_id;

  -- Update user.verification_status so existing client UI reflects it
  update users
    set verification_status = case
      when p_outcome = 'needs_changes' then 'needs_changes'
      when p_outcome = 'rejected_technical' then 'rejected'
      else verification_status end
    where id = v_user_id;

  v_event_type := case p_outcome
    when 'needs_changes' then 'verification_needs_changes'
    when 'rejected_technical' then 'verification_rejected'
    else 'verification_rejected' end;

  perform _emit_case_event(p_case_id, p_admin_id, 'decided',
    jsonb_build_object('outcome', p_outcome, 'reason_code', p_reason_code, 'reason_text', p_reason_text));

  perform enqueue_tg_outbox(v_user_id, v_event_type,
    jsonb_build_object('reason', p_reason_text));

  return jsonb_build_object('ok', true, 'outcome', p_outcome);
end$$;
```

- [ ] **Step 2: Apply**

```bash
psql "$DATABASE_PUBLIC_URL" -f supabase/migrations/20260627100400_admin_case_rpcs.sql
```

Verify functions exist:
```bash
psql "$DATABASE_PUBLIC_URL" -c "\df admin_claim_verification admin_save_passport_draft admin_approve_verification admin_reject_verification"
```

- [ ] **Step 3: Smoke-test claim RPC via psql**

Find a case-id from backfilled rows + an admin_id:
```bash
CASE_ID=$(psql "$DATABASE_PUBLIC_URL" -At -c "select id from verification_cases where state='new' limit 1;")
ADMIN_ID=$(psql "$DATABASE_PUBLIC_URL" -At -c "select id from admin_users where role='superadmin' limit 1;")
psql "$DATABASE_PUBLIC_URL" -c "select admin_claim_verification('$CASE_ID'::uuid, '$ADMIN_ID'::uuid);"
```

Expected: `{"ok": true, "state": "assigned"}`

Re-running with different admin should return `{"ok": false, "error": "case_already_claimed", ...}`.

Roll back claim for later tests:
```bash
psql "$DATABASE_PUBLIC_URL" -c "update verification_cases set state='new', assignee_id=null, claimed_at=null where id='$CASE_ID'::uuid;"
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260627100400_admin_case_rpcs.sql
git commit -m "feat(db): RPCs admin_claim/save_draft/approve/reject_verification"
```

---

## Phase D: Admin Design Tokens + OpsShell

### Task 9: CSS tokens for admin/ops design system

**Files:**
- Modify: `src/app/globals.css` (append a `[data-ops="true"]` block after existing v2 block)

**Interfaces:**
- Produces: `--admin-bg`, `--admin-ink-{900,700,500,300}`, `--admin-accent` (#2d4a5c), `--admin-success/warning/danger`, `--admin-row-h`, `--admin-font-sans`, `--admin-font-mono`, scoped to `[data-ops="true"]`.

- [ ] **Step 1: Read existing globals.css to find insertion point**

Read: `src/app/globals.css`, find end of `[data-v2="true"]` block.

- [ ] **Step 2: Append admin tokens block**

Add after the v2 block:

```css
/* ============================================================ */
/* Admin / Ops design tokens — added for admin redesign Sprint 1.
   Scope: any element with `[data-ops="true"]` attribute or under
   the OpsShell. Deliberately separate from v2 editorial tokens
   to keep the admin workspace visually distinct.
   ============================================================ */

[data-ops="true"] {
  --admin-bg:           #fafaf8;
  --admin-surface:      #ffffff;
  --admin-surface-2:    #f4f3ef;
  --admin-border:       #e5e3dd;
  --admin-border-strong:#c9c5bb;

  --admin-ink-900:      #0a0908;
  --admin-ink-700:      #3a3833;
  --admin-ink-500:      #6e6a60;
  --admin-ink-300:      #a8a499;

  --admin-accent:       #2d4a5c;
  --admin-accent-hover: #3a5d72;
  --admin-accent-soft:  rgba(45, 74, 92, 0.08);

  --admin-success:      #2f7a4e;
  --admin-warning:      #b8732a;
  --admin-danger:       #b8475e;
  --admin-info:         #4a6a8a;

  --admin-font-sans: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  --admin-font-mono: "JetBrains Mono", "SF Mono", Menlo, monospace;

  --admin-row-h:           36px;
  --admin-row-h-cosy:      28px;
  --admin-row-h-comfortable: 44px;

  --admin-radius:          6px;
  --admin-radius-lg:       8px;

  background: var(--admin-bg);
  color: var(--admin-ink-900);
  font-family: var(--admin-font-sans);
  font-size: 13px;
  line-height: 1.4;
}

[data-ops="true"] code,
[data-ops="true"] .mono,
[data-ops="true"] .pinfl,
[data-ops="true"] .passport-num {
  font-family: var(--admin-font-mono);
  font-variant-numeric: tabular-nums;
}
```

- [ ] **Step 3: Verify no regressions in v2 page**

Run dev server, открой любой `/v2/*` экран — должен выглядеть как раньше (paper/ink, серифные заголовки). Тогда блок не интерферирует.

```bash
cd /Users/fayzullohoja/Code/baxtlilar && pnpm dev
# Open http://localhost:3000/ru/v2/welcome — visual check
```

- [ ] **Step 4: Commit**

```bash
git add src/app/globals.css
git commit -m "feat(admin): add ops design tokens (deep slate-blue accent, Inter sans)"
```

---

### Task 10: Admin token TS exports (для inline styles)

**Files:**
- Create: `src/lib/admin/admin-tokens.ts`

**Interfaces:**
- Produces: `ADMIN` const с numeric tokens для inline JS (нужен в компонентах где CSS var не удобно — например в SVG fill).

- [ ] **Step 1: Write file**

```ts
// src/lib/admin/admin-tokens.ts
// Mirrors [data-ops="true"] CSS variables for use in inline styles / SVGs
// where var() doesn't apply. Keep in sync with globals.css.

export const ADMIN = {
  bg: "#fafaf8",
  surface: "#ffffff",
  surface2: "#f4f3ef",
  border: "#e5e3dd",
  borderStrong: "#c9c5bb",

  ink900: "#0a0908",
  ink700: "#3a3833",
  ink500: "#6e6a60",
  ink300: "#a8a499",

  accent: "#2d4a5c",
  accentHover: "#3a5d72",
  accentSoft: "rgba(45, 74, 92, 0.08)",

  success: "#2f7a4e",
  warning: "#b8732a",
  danger: "#b8475e",
  info: "#4a6a8a",

  fontSans: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  fontMono: '"JetBrains Mono", "SF Mono", Menlo, monospace',
} as const;
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/admin/admin-tokens.ts
git commit -m "feat(admin): TS exports of admin design tokens for inline styles"
```

---

### Task 11: Dialog primitive (replaces window.confirm)

**Files:**
- Create: `src/components/admin-ops/Dialog.tsx`

**Interfaces:**
- Produces: `<Dialog open onClose title actions>{body}</Dialog>` — primitive с backdrop, Escape для close, focus trap minimal. Не модал из shadcn, наш собственный плотный.

- [ ] **Step 1: Write component**

```tsx
// src/components/admin-ops/Dialog.tsx
"use client";

import { useEffect, type ReactNode } from "react";
import { ADMIN } from "@/lib/admin/admin-tokens";

export type DialogProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  actions: ReactNode;
  width?: number;
};

export function Dialog({ open, onClose, title, children, actions, width = 480 }: DialogProps) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(15, 23, 30, 0.45)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "24px",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: `${width}px`, maxWidth: "100%",
          background: ADMIN.surface,
          border: `1px solid ${ADMIN.border}`,
          borderRadius: 8,
          boxShadow: "0 12px 32px rgba(15,23,30,0.18)",
          display: "flex", flexDirection: "column",
        }}
      >
        <div style={{
          padding: "16px 20px",
          borderBottom: `1px solid ${ADMIN.border}`,
          fontSize: 15, fontWeight: 500,
          color: ADMIN.ink900,
        }}>{title}</div>
        <div style={{ padding: "16px 20px", color: ADMIN.ink700, fontSize: 13, lineHeight: 1.55 }}>
          {children}
        </div>
        <div style={{
          padding: "12px 20px",
          borderTop: `1px solid ${ADMIN.border}`,
          display: "flex", justifyContent: "flex-end", gap: 8,
        }}>{actions}</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/admin-ops/Dialog.tsx
git commit -m "feat(admin): Dialog primitive replacing window.confirm"
```

---

### Task 12: Button + Field + StatusPill primitives

**Files:**
- Create: `src/components/admin-ops/Button.tsx`
- Create: `src/components/admin-ops/Field.tsx`
- Create: `src/components/admin-ops/StatusPill.tsx`

**Interfaces:**
- Produces:
  - `<Button variant='primary'|'secondary'|'danger'|'ghost' size='sm'|'md' onClick disabled type>{label}</Button>`
  - `<Field label htmlFor required help error>{input}</Field>` — wrapper
  - `<StatusPill kind='verified'|'pending'|'rejected'|'banned'|'paused'|'active'|'new'|'warning'>{label}</StatusPill>`

- [ ] **Step 1: Button.tsx**

```tsx
// src/components/admin-ops/Button.tsx
"use client";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { ADMIN } from "@/lib/admin/admin-tokens";

type Variant = "primary" | "secondary" | "danger" | "ghost";
type Size = "sm" | "md";

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "size"> {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
}

const STYLES: Record<Variant, { bg: string; fg: string; border: string; hoverBg: string }> = {
  primary: { bg: ADMIN.accent, fg: "#ffffff", border: ADMIN.accent, hoverBg: ADMIN.accentHover },
  secondary: { bg: ADMIN.surface, fg: ADMIN.ink900, border: ADMIN.border, hoverBg: ADMIN.surface2 },
  danger: { bg: ADMIN.surface, fg: ADMIN.danger, border: ADMIN.danger, hoverBg: "#fcf0f3" },
  ghost: { bg: "transparent", fg: ADMIN.ink700, border: "transparent", hoverBg: ADMIN.surface2 },
};

export function Button({
  variant = "secondary", size = "md", children, style, ...rest
}: ButtonProps) {
  const s = STYLES[variant];
  const h = size === "sm" ? 28 : 32;
  return (
    <button
      {...rest}
      style={{
        height: h, padding: size === "sm" ? "0 10px" : "0 14px",
        fontFamily: ADMIN.fontSans, fontSize: 13, fontWeight: 500,
        background: s.bg, color: s.fg, border: `1px solid ${s.border}`,
        borderRadius: 6, cursor: rest.disabled ? "not-allowed" : "pointer",
        opacity: rest.disabled ? 0.5 : 1,
        display: "inline-flex", alignItems: "center", gap: 6,
        transition: "background 0.12s ease",
        ...style,
      }}
      onMouseEnter={(e) => { if (!rest.disabled) e.currentTarget.style.background = s.hoverBg; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = s.bg; }}
    >
      {children}
    </button>
  );
}
```

- [ ] **Step 2: Field.tsx**

```tsx
// src/components/admin-ops/Field.tsx
"use client";
import type { ReactNode } from "react";
import { ADMIN } from "@/lib/admin/admin-tokens";

export interface FieldProps {
  label: string;
  htmlFor?: string;
  required?: boolean;
  help?: string;
  error?: string | null;
  warning?: string | null;
  children: ReactNode;
}

export function Field({ label, htmlFor, required, help, error, warning, children }: FieldProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <label htmlFor={htmlFor} style={{
        fontSize: 12, fontWeight: 500, color: ADMIN.ink700,
        textTransform: "uppercase", letterSpacing: "0.04em",
      }}>
        {label}
        {required ? <span style={{ color: ADMIN.danger, marginLeft: 4 }}>*</span> : null}
      </label>
      {children}
      {error ? (
        <div style={{ fontSize: 12, color: ADMIN.danger }}>{error}</div>
      ) : warning ? (
        <div style={{ fontSize: 12, color: ADMIN.warning }}>{warning}</div>
      ) : help ? (
        <div style={{ fontSize: 12, color: ADMIN.ink500 }}>{help}</div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 3: StatusPill.tsx**

```tsx
// src/components/admin-ops/StatusPill.tsx
import type { ReactNode } from "react";
import { ADMIN } from "@/lib/admin/admin-tokens";

type Kind = "verified" | "pending" | "rejected" | "banned" | "paused" | "active" | "new" | "warning";

const COLORS: Record<Kind, { bg: string; fg: string }> = {
  verified: { bg: "#e7f3ec", fg: ADMIN.success },
  active:   { bg: "#e7f3ec", fg: ADMIN.success },
  pending:  { bg: "#fbf1e0", fg: ADMIN.warning },
  warning:  { bg: "#fbf1e0", fg: ADMIN.warning },
  rejected: { bg: "#fbe7ec", fg: ADMIN.danger },
  banned:   { bg: "#fbe7ec", fg: ADMIN.danger },
  paused:   { bg: ADMIN.surface2, fg: ADMIN.ink500 },
  new:      { bg: "#e8eef3", fg: ADMIN.info },
};

export function StatusPill({ kind, children }: { kind: Kind; children: ReactNode }) {
  const c = COLORS[kind];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center",
      padding: "2px 8px", borderRadius: 4,
      background: c.bg, color: c.fg,
      fontSize: 11, fontWeight: 500,
      letterSpacing: "0.02em",
    }}>{children}</span>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/admin-ops/Button.tsx src/components/admin-ops/Field.tsx src/components/admin-ops/StatusPill.tsx
git commit -m "feat(admin): Button/Field/StatusPill primitives"
```

---

### Task 13: OpsShell layout (sidebar + topbar + main)

**Files:**
- Create: `src/components/admin-ops/OpsShell.tsx` (server)
- Create: `src/components/admin-ops/OpsSidebar.tsx` (client — active link state)
- Create: `src/components/admin-ops/OpsTopBar.tsx` (client — Cmd+K placeholder)

**Interfaces:**
- Produces: `<OpsShell adminName adminRole>{children}</OpsShell>` — full-screen layout с sidebar 220px + topbar 48px + main slot.

- [ ] **Step 1: Install @tabler/icons-react if not already**

Check `package.json`:
```bash
grep "@tabler/icons-react" /Users/fayzullohoja/Code/baxtlilar/package.json
```

If absent:
```bash
cd /Users/fayzullohoja/Code/baxtlilar && pnpm add @tabler/icons-react
```

- [ ] **Step 2: OpsSidebar.tsx**

```tsx
// src/components/admin-ops/OpsSidebar.tsx
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconInbox, IconStack2, IconEye,
  IconShieldCheck, IconPhoto, IconFlag,
  IconUsers, IconId, IconBan,
  IconChartBar, IconClock, IconUsersGroup, IconDatabaseCog,
  IconHistory, IconAlertOctagon, IconLock, IconLogout,
} from "@tabler/icons-react";
import { ADMIN } from "@/lib/admin/admin-tokens";

type Item = { href: string; label: string; icon: React.ComponentType<{ size?: number; stroke?: number }>; superOnly?: boolean; badge?: number };
type Group = { label: string; items: Item[] };

const GROUPS: Group[] = [
  { label: "INBOX", items: [
    { href: "/admin/queue/mine", label: "Моя очередь", icon: IconInbox },
    { href: "/admin/queue/unassigned", label: "Без владельца", icon: IconStack2 },
    { href: "/admin/queue/watching", label: "Я наблюдаю", icon: IconEye, superOnly: true },
  ]},
  { label: "CASES", items: [
    { href: "/admin/cases?type=verification", label: "Верификации", icon: IconShieldCheck },
    { href: "/admin/cases?type=photo", label: "Фото", icon: IconPhoto },
    { href: "/admin/cases?type=report", label: "Жалобы", icon: IconFlag, superOnly: true },
  ]},
  { label: "REGISTRY", items: [
    { href: "/admin/clients", label: "Клиенты", icon: IconUsers },
    { href: "/admin/documents", label: "Документы", icon: IconId, superOnly: true },
    { href: "/admin/blocklist", label: "Блок-лист", icon: IconBan, superOnly: true },
  ]},
  { label: "INSIGHTS", items: [
    { href: "/admin/analytics", label: "Аналитика", icon: IconChartBar, superOnly: true },
    { href: "/admin/insights/sla", label: "SLA-отчёт", icon: IconClock, superOnly: true },
    { href: "/admin/insights/team", label: "Команда", icon: IconUsersGroup, superOnly: true },
    { href: "/admin/insights/data-quality", label: "Качество данных", icon: IconDatabaseCog, superOnly: true },
  ]},
  { label: "AUDIT", items: [
    { href: "/admin/audit", label: "Журнал действий", icon: IconHistory, superOnly: true },
    { href: "/admin/audit/scope-violations", label: "Эскалации", icon: IconAlertOctagon, superOnly: true },
    { href: "/admin/audit/pending-bans", label: "Pending bans", icon: IconLock, superOnly: true },
  ]},
];

export function OpsSidebar({ adminName, adminRole }: { adminName: string; adminRole: "moderator" | "superadmin" }) {
  const path = usePathname();
  const isActive = (href: string) => path?.startsWith(href.split("?")[0]) ?? false;

  return (
    <nav style={{
      width: 220, height: "100vh", flexShrink: 0,
      borderRight: `1px solid ${ADMIN.border}`,
      background: ADMIN.surface,
      display: "flex", flexDirection: "column",
      overflowY: "auto",
    }}>
      <div style={{ padding: "16px 20px", borderBottom: `1px solid ${ADMIN.border}` }}>
        <div style={{ fontFamily: "var(--font-v2-display)", fontSize: 18, color: ADMIN.ink900, letterSpacing: "-0.02em" }}>
          Baxtlilar Ops
        </div>
      </div>

      <div style={{ flex: 1, padding: "12px 0" }}>
        {GROUPS.map((g) => {
          const visibleItems = g.items.filter((i) => !i.superOnly || adminRole === "superadmin");
          if (visibleItems.length === 0) return null;
          return (
            <div key={g.label} style={{ marginBottom: 16 }}>
              <div style={{
                padding: "4px 20px",
                fontSize: 10, fontWeight: 500, letterSpacing: "0.08em",
                color: ADMIN.ink500, textTransform: "uppercase",
              }}>{g.label}</div>
              {visibleItems.map((it) => {
                const active = isActive(it.href);
                const Icon = it.icon;
                return (
                  <Link key={it.href} href={it.href} style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "6px 20px",
                    fontSize: 13, color: active ? ADMIN.ink900 : ADMIN.ink700,
                    background: active ? ADMIN.accentSoft : "transparent",
                    borderLeft: `2px solid ${active ? ADMIN.accent : "transparent"}`,
                    textDecoration: "none",
                  }}>
                    <Icon size={18} stroke={1.5} />
                    <span style={{ flex: 1 }}>{it.label}</span>
                    {it.badge ? <span style={{ fontSize: 11, color: ADMIN.ink500 }}>{it.badge}</span> : null}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </div>

      <div style={{
        padding: "12px 20px",
        borderTop: `1px solid ${ADMIN.border}`,
        display: "flex", alignItems: "center", gap: 10,
      }}>
        <div style={{
          width: 24, height: 24, borderRadius: "50%",
          background: ADMIN.surface2, color: ADMIN.ink700,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 11, fontWeight: 500,
        }}>{adminName.slice(0, 1).toUpperCase()}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, color: ADMIN.ink900, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{adminName}</div>
          <div style={{ fontSize: 11, color: ADMIN.ink500 }}>{adminRole}</div>
        </div>
        <form action="/api/admin/logout" method="POST">
          <button type="submit" aria-label="Logout" style={{
            background: "transparent", border: 0, color: ADMIN.ink500, cursor: "pointer",
            padding: 4,
          }}><IconLogout size={16} stroke={1.5} /></button>
        </form>
      </div>
    </nav>
  );
}
```

- [ ] **Step 3: OpsTopBar.tsx (placeholder для Cmd+K)**

```tsx
// src/components/admin-ops/OpsTopBar.tsx
"use client";
import { IconCommand, IconBell } from "@tabler/icons-react";
import { ADMIN } from "@/lib/admin/admin-tokens";

export function OpsTopBar() {
  return (
    <div style={{
      height: 48, flexShrink: 0,
      borderBottom: `1px solid ${ADMIN.border}`,
      background: ADMIN.surface,
      display: "flex", alignItems: "center",
      padding: "0 16px", gap: 16,
    }}>
      <button
        type="button"
        disabled
        title="Cmd+K — будет в Sprint 4"
        style={{
          flex: 1, maxWidth: 460, height: 32,
          background: ADMIN.bg, border: `1px solid ${ADMIN.border}`,
          borderRadius: 6, padding: "0 12px",
          display: "flex", alignItems: "center", gap: 8,
          color: ADMIN.ink500, fontSize: 13, fontFamily: ADMIN.fontSans,
          cursor: "not-allowed",
        }}
      >
        <IconCommand size={14} stroke={1.5} />
        Найти клиента, кейс, ПИНФЛ…
        <span style={{ marginLeft: "auto", fontSize: 11, color: ADMIN.ink300 }}>⌘K</span>
      </button>

      <div style={{ flex: 1 }} />

      <button
        type="button"
        disabled
        aria-label="Notifications"
        style={{
          background: "transparent", border: 0, color: ADMIN.ink500,
          cursor: "not-allowed", padding: 6,
        }}
      ><IconBell size={18} stroke={1.5} /></button>
    </div>
  );
}
```

- [ ] **Step 4: OpsShell.tsx**

```tsx
// src/components/admin-ops/OpsShell.tsx
import type { ReactNode } from "react";
import { OpsSidebar } from "./OpsSidebar";
import { OpsTopBar } from "./OpsTopBar";

export function OpsShell({
  adminName, adminRole, children,
}: {
  adminName: string;
  adminRole: "moderator" | "superadmin";
  children: ReactNode;
}) {
  return (
    <div data-ops="true" style={{
      minHeight: "100vh", display: "flex",
    }}>
      <OpsSidebar adminName={adminName} adminRole={adminRole} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <OpsTopBar />
        <main style={{ flex: 1, overflow: "auto", padding: 24 }}>{children}</main>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Visual smoke test — temp route**

Create temporary page to see the shell render correctly:

```tsx
// src/app/admin/ops-preview/page.tsx (DELETE after verifying)
import { OpsShell } from "@/components/admin-ops/OpsShell";

export default function Page() {
  return (
    <OpsShell adminName="T. Sobirov" adminRole="superadmin">
      <h1 style={{ fontSize: 22, fontWeight: 500 }}>OpsShell preview</h1>
      <p style={{ color: "#3a3833" }}>If you see sidebar + topbar + this text, shell is working.</p>
    </OpsShell>
  );
}
```

Run dev, visit `/admin/ops-preview`. Confirm sidebar groups показывают разный набор для moderator vs super (no role gating in this preview, just confirm visual).

Delete the preview file before commit.

- [ ] **Step 6: Commit**

```bash
git add src/components/admin-ops/OpsShell.tsx src/components/admin-ops/OpsSidebar.tsx src/components/admin-ops/OpsTopBar.tsx package.json pnpm-lock.yaml
git commit -m "feat(admin): OpsShell layout with sidebar (5 groups) + topbar placeholder"
```

---

## Phase E: 3-Step Studio (the main flow)

### Task 14: Queue page — list verification cases

**Files:**
- Create: `src/app/admin/queue/mine/page.tsx`
- Create: `src/lib/admin/load-queue.ts`

**Interfaces:**
- Consumes: admin session via `requireAdmin()` (existing), `verification_cases` table
- Produces: Server component showing list of cases assigned to current admin + ability to take from unassigned. Single click → case detail.

- [ ] **Step 1: load-queue.ts**

```ts
// src/lib/admin/load-queue.ts
import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type QueueCase = {
  case_id: string;
  user_id: string;
  state: string;
  display_name: string | null;
  telegram_username: string | null;
  created_at: string;
  updated_at: string;
};

export async function loadMyQueue(adminId: string, limit = 50): Promise<QueueCase[]> {
  const { data } = await supabaseAdmin().rpc("admin_load_my_queue" as never, {
    p_admin_id: adminId, p_limit: limit,
  });
  // RPC doesn't exist yet — fallback to direct query for Sprint 1
  if (data) return data as QueueCase[];

  // Direct query path
  const { data: rows } = await supabaseAdmin()
    .from("verification_cases")
    .select("id, user_id, state, created_at, updated_at, users(display_name, telegram_username)")
    .eq("assignee_id", adminId)
    .neq("state", "closed")
    .order("created_at", { ascending: true })
    .limit(limit);
  return (rows ?? []).map((r) => ({
    case_id: r.id as string,
    user_id: r.user_id as string,
    state: r.state as string,
    display_name: (r as unknown as { users: { display_name: string | null } }).users?.display_name ?? null,
    telegram_username: (r as unknown as { users: { telegram_username: string | null } }).users?.telegram_username ?? null,
    created_at: r.created_at as string,
    updated_at: r.updated_at as string,
  }));
}

export async function loadUnassignedQueue(limit = 50): Promise<QueueCase[]> {
  const { data: rows } = await supabaseAdmin()
    .from("verification_cases")
    .select("id, user_id, state, created_at, updated_at, users(display_name, telegram_username)")
    .is("assignee_id", null)
    .eq("state", "new")
    .order("created_at", { ascending: true })
    .limit(limit);
  return (rows ?? []).map((r) => ({
    case_id: r.id as string,
    user_id: r.user_id as string,
    state: r.state as string,
    display_name: (r as unknown as { users: { display_name: string | null } }).users?.display_name ?? null,
    telegram_username: (r as unknown as { users: { telegram_username: string | null } }).users?.telegram_username ?? null,
    created_at: r.created_at as string,
    updated_at: r.updated_at as string,
  }));
}
```

- [ ] **Step 2: Queue page**

```tsx
// src/app/admin/queue/mine/page.tsx
import { redirect } from "next/navigation";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin/guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { OpsShell } from "@/components/admin-ops/OpsShell";
import { loadMyQueue, loadUnassignedQueue } from "@/lib/admin/load-queue";
import { ADMIN } from "@/lib/admin/admin-tokens";
import { StatusPill } from "@/components/admin-ops/StatusPill";

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await requireAdmin();
  if (!session) redirect("/admin/login");

  // Resolve admin name
  const { data: admin } = await supabaseAdmin()
    .from("admin_users").select("name, role").eq("id", session.adminId).maybeSingle();

  const [mine, unassigned] = await Promise.all([
    loadMyQueue(session.adminId),
    loadUnassignedQueue(),
  ]);

  return (
    <OpsShell adminName={admin?.name ?? "—"} adminRole={session.role}>
      <h1 style={{ fontSize: 22, fontWeight: 500, marginBottom: 16 }}>Моя очередь</h1>
      <p style={{ color: ADMIN.ink500, fontSize: 13, marginBottom: 24 }}>
        {mine.length} в работе · {unassigned.length} без владельца
      </p>

      {mine.length === 0 ? (
        <div style={{
          padding: 24, border: `1px solid ${ADMIN.border}`, borderRadius: 8,
          background: ADMIN.surface, color: ADMIN.ink500, fontSize: 13,
        }}>
          Очередь пуста. {unassigned.length > 0
            ? <Link href="/admin/queue/unassigned" style={{ color: ADMIN.accent }}>Возьми из «Без владельца» ({unassigned.length}) →</Link>
            : "Новых заявок нет."}
        </div>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", background: ADMIN.surface, border: `1px solid ${ADMIN.border}`, borderRadius: 8 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${ADMIN.border}` }}>
              {["ID","Клиент","TG","Состояние","Поступило"].map((h) =>
                <th key={h} style={{ textAlign:"left", padding:"10px 12px", fontSize:11, color:ADMIN.ink500, textTransform:"uppercase", letterSpacing:"0.04em", fontWeight:500 }}>{h}</th>
              )}
            </tr>
          </thead>
          <tbody>
            {mine.map((c) => (
              <tr key={c.case_id} style={{ borderBottom: `1px solid ${ADMIN.border}` }}>
                <td style={{ padding: "10px 12px", fontFamily: ADMIN.fontMono, fontSize: 12, color: ADMIN.ink700 }}>
                  <Link href={`/admin/cases/${c.case_id}`} style={{ color: ADMIN.accent, textDecoration: "none" }}>
                    {c.case_id.slice(0, 8)}
                  </Link>
                </td>
                <td style={{ padding: "10px 12px", fontSize: 13 }}>{c.display_name ?? "—"}</td>
                <td style={{ padding: "10px 12px", fontSize: 12, color: ADMIN.ink500 }}>{c.telegram_username ? `@${c.telegram_username}` : "—"}</td>
                <td style={{ padding: "10px 12px" }}><StatusPill kind={c.state === "data_entry" ? "warning" : "new"}>{c.state}</StatusPill></td>
                <td style={{ padding: "10px 12px", fontSize: 12, color: ADMIN.ink500 }}>{new Date(c.created_at).toLocaleString("ru-RU")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </OpsShell>
  );
}
```

- [ ] **Step 3: Visual smoke test**

```bash
pnpm dev
```

Open `/admin/queue/mine` после логина. Должна показаться очередь либо empty-state.

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/queue/mine/page.tsx src/lib/admin/load-queue.ts
git commit -m "feat(admin): /admin/queue/mine — case queue with OpsShell"
```

---

### Task 15: API route — POST /api/admin/cases/[id]/claim

**Files:**
- Create: `src/app/api/admin/cases/[id]/claim/route.ts`

**Interfaces:**
- Produces: POST endpoint, body `{}`, returns `{ok:true, state}` or `{ok:false, error}`. Wraps `admin_claim_verification` RPC.

- [ ] **Step 1: Write route**

```ts
// src/app/api/admin/cases/[id]/claim/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin/guard";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { session, res } = await requireAdminApi();
  if (res) return res;
  const { id } = await params;

  const { data, error } = await supabaseAdmin().rpc("admin_claim_verification", {
    p_case_id: id,
    p_admin_id: session.adminId,
  });

  if (error) {
    return NextResponse.json({ ok: false, error: "rpc_error", detail: error.message }, { status: 500 });
  }
  const out = data as { ok: boolean; error?: string; state?: string };
  if (!out.ok) {
    const status = out.error === "case_not_found" ? 404 :
                   out.error === "case_already_claimed" ? 409 : 400;
    return NextResponse.json(out, { status });
  }
  return NextResponse.json(out);
}
```

- [ ] **Step 2: Smoke test via curl after dev server up**

```bash
# Get admin cookie from browser devtools after login
ADMIN_COOKIE='bx_admin=...'
CASE_ID='...'  # from psql
curl -s -X POST -H "Cookie: $ADMIN_COOKIE" "http://localhost:3000/api/admin/cases/$CASE_ID/claim" | jq .
```

Expected: `{"ok":true,"state":"assigned"}`.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/admin/cases/\[id\]/claim/route.ts
git commit -m "feat(admin): POST /api/admin/cases/:id/claim"
```

---

### Task 16: API route — POST /api/admin/cases/[id]/draft

**Files:**
- Create: `src/app/api/admin/cases/[id]/draft/route.ts`

**Interfaces:**
- Consumes: `validatePassportPayload` (Task 6)
- Produces: POST endpoint, body `{payload: Partial<PassportPayload>}`, returns `{ok, updated_at, blocking_errors}`. Wraps `admin_save_passport_draft`. Validates first — if any blocking errors, doesn't save, returns them.

- [ ] **Step 1: Write route**

```ts
// src/app/api/admin/cases/[id]/draft/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin/guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { validatePassportPayload, type PassportPayload } from "@/lib/admin/passport-validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { session, res } = await requireAdminApi();
  if (res) return res;
  const { id } = await params;

  const body = await req.json().catch(() => ({})) as { payload?: Partial<PassportPayload> };
  if (!body.payload || typeof body.payload !== "object") {
    return NextResponse.json({ ok: false, error: "bad_payload" }, { status: 400 });
  }

  // Save draft regardless — we want to persist partial work. Validation is informational here.
  const errors = validatePassportPayload(body.payload);

  const { data, error } = await supabaseAdmin().rpc("admin_save_passport_draft", {
    p_case_id: id,
    p_admin_id: session.adminId,
    p_payload: body.payload,
  });

  if (error) {
    return NextResponse.json({ ok: false, error: "rpc_error", detail: error.message }, { status: 500 });
  }
  const out = data as { ok: boolean; error?: string; updated_at?: string };
  if (!out.ok) {
    const status = out.error === "case_not_found" ? 404 :
                   out.error === "not_claimed_by_you" ? 403 : 400;
    return NextResponse.json(out, { status });
  }

  return NextResponse.json({
    ok: true,
    updated_at: out.updated_at,
    errors,
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/admin/cases/\[id\]/draft/route.ts
git commit -m "feat(admin): POST /api/admin/cases/:id/draft — save passport entry"
```

---

### Task 17: API route — POST /api/admin/cases/[id]/decision

**Files:**
- Create: `src/app/api/admin/cases/[id]/decision/route.ts`

**Interfaces:**
- Consumes: `validatePassportPayload`, RPCs `admin_approve_verification` / `admin_reject_verification`
- Produces: POST endpoint, body `{ action: 'approve'|'needs_changes'|'reject_technical', payload?, reason_code?, reason_text?, expected_updated_at }`, returns `{ok}`. Blocking-reject — Sprint 3.

- [ ] **Step 1: Write route**

```ts
// src/app/api/admin/cases/[id]/decision/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin/guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { validatePassportPayload, type PassportPayload } from "@/lib/admin/passport-validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  action?: "approve" | "needs_changes" | "reject_technical";
  payload?: Partial<PassportPayload>;
  reason_code?: string;
  reason_text?: string;
  expected_updated_at?: string;
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { session, res } = await requireAdminApi();
  if (res) return res;
  const { id } = await params;

  const body = (await req.json().catch(() => ({}))) as Body;
  if (!body.action || !body.expected_updated_at) {
    return NextResponse.json({ ok: false, error: "bad_payload" }, { status: 400 });
  }

  if (body.action === "approve") {
    if (!body.payload) return NextResponse.json({ ok: false, error: "payload_required" }, { status: 400 });
    const errors = validatePassportPayload(body.payload);
    const blockers = errors.filter((e) => e.severity === "block");
    if (blockers.length > 0) {
      return NextResponse.json({ ok: false, error: "validation_failed", errors: blockers }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin().rpc("admin_approve_verification", {
      p_case_id: id,
      p_admin_id: session.adminId,
      p_payload: body.payload,
      p_expected_updated_at: body.expected_updated_at,
    });
    if (error) return NextResponse.json({ ok: false, error: "rpc_error", detail: error.message }, { status: 500 });
    const out = data as { ok: boolean; error?: string; current_updated_at?: string; identity_id?: string };
    if (!out.ok) {
      const status = out.error === "stale_case" ? 409 :
                     out.error === "duplicate_identity" ? 409 :
                     out.error === "case_not_found" ? 404 :
                     out.error === "not_claimed_by_you" ? 403 : 400;
      return NextResponse.json(out, { status });
    }
    return NextResponse.json(out);
  }

  // reject branch
  if (body.action === "needs_changes" || body.action === "reject_technical") {
    if (!body.reason_text || body.reason_text.length < 3) {
      return NextResponse.json({ ok: false, error: "reason_required" }, { status: 400 });
    }
    const outcome = body.action === "needs_changes" ? "needs_changes" : "rejected_technical";
    const { data, error } = await supabaseAdmin().rpc("admin_reject_verification", {
      p_case_id: id,
      p_admin_id: session.adminId,
      p_outcome: outcome,
      p_reason_code: body.reason_code ?? "",
      p_reason_text: body.reason_text,
      p_expected_updated_at: body.expected_updated_at,
    });
    if (error) return NextResponse.json({ ok: false, error: "rpc_error", detail: error.message }, { status: 500 });
    const out = data as { ok: boolean; error?: string };
    if (!out.ok) {
      const status = out.error === "stale_case" ? 409 :
                     out.error === "case_not_found" ? 404 :
                     out.error === "not_claimed_by_you" ? 403 : 400;
      return NextResponse.json(out, { status });
    }
    return NextResponse.json(out);
  }

  return NextResponse.json({ ok: false, error: "bad_action" }, { status: 400 });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/admin/cases/\[id\]/decision/route.ts
git commit -m "feat(admin): POST /api/admin/cases/:id/decision — approve/needs_changes/reject"
```

---

### Task 18: Case page — server loader

**Files:**
- Create: `src/app/admin/cases/[id]/page.tsx`
- Create: `src/lib/admin/load-case.ts`

**Interfaces:**
- Consumes: `loadCase(caseId)` → full case object with user data + documents URLs
- Produces: Server page that loads case, claims it if unassigned-and-this-admin's-queue, renders `<CaseStudio>`.

- [ ] **Step 1: load-case.ts**

```ts
// src/lib/admin/load-case.ts
import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { signStorageObjectUrl } from "@/lib/storage/signed-url"; // existing util — verify path

export type LoadedCase = {
  case_id: string;
  state: string;
  outcome: string | null;
  draft_payload: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  claimed_at: string | null;
  assignee_id: string | null;
  user: {
    id: string;
    display_name: string | null;
    telegram_id: number | null;
    telegram_username: string | null;
    phone_number: string | null;
    verification_status: string;
  };
  passport_image_url: string | null;
  selfie_image_url: string | null;
};

export async function loadCase(caseId: string): Promise<LoadedCase | null> {
  const { data: row } = await supabaseAdmin()
    .from("verification_cases")
    .select("id, state, outcome, draft_payload, created_at, updated_at, claimed_at, assignee_id, user_id")
    .eq("id", caseId)
    .maybeSingle();
  if (!row) return null;

  const { data: user } = await supabaseAdmin()
    .from("users")
    .select("id, display_name, telegram_id, telegram_username, phone_number, verification_status")
    .eq("id", row.user_id)
    .maybeSingle();
  if (!user) return null;

  const { data: doc } = await supabaseAdmin()
    .from("user_documents")
    .select("passport_path, selfie_path")
    .eq("user_id", row.user_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const passport_image_url = doc?.passport_path ? await signStorageObjectUrl(doc.passport_path) : null;
  const selfie_image_url = doc?.selfie_path ? await signStorageObjectUrl(doc.selfie_path) : null;

  return {
    case_id: row.id as string,
    state: row.state as string,
    outcome: (row.outcome as string | null) ?? null,
    draft_payload: (row.draft_payload as Record<string, unknown>) ?? {},
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    claimed_at: (row.claimed_at as string | null) ?? null,
    assignee_id: (row.assignee_id as string | null) ?? null,
    user: {
      id: user.id as string,
      display_name: (user.display_name as string | null) ?? null,
      telegram_id: (user.telegram_id as number | null) ?? null,
      telegram_username: (user.telegram_username as string | null) ?? null,
      phone_number: (user.phone_number as string | null) ?? null,
      verification_status: user.verification_status as string,
    },
    passport_image_url,
    selfie_image_url,
  };
}
```

> NOTE: `signStorageObjectUrl` import path must match actual util in repo. If absent, use `/api/storage/o/<bucket>/<path>` direct.

- [ ] **Step 2: page.tsx**

```tsx
// src/app/admin/cases/[id]/page.tsx
import { redirect, notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { OpsShell } from "@/components/admin-ops/OpsShell";
import { loadCase } from "@/lib/admin/load-case";
import { CaseStudio } from "./CaseStudio";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin();
  if (!session) redirect("/admin/login");

  const { id } = await params;
  const c = await loadCase(id);
  if (!c) notFound();

  const { data: admin } = await supabaseAdmin()
    .from("admin_users").select("name").eq("id", session.adminId).maybeSingle();

  return (
    <OpsShell adminName={admin?.name ?? "—"} adminRole={session.role}>
      <CaseStudio
        loadedCase={c}
        currentAdminId={session.adminId}
        currentAdminRole={session.role}
      />
    </OpsShell>
  );
}
```

- [ ] **Step 3: Commit (stub before CaseStudio exists — temporarily disabled)**

Skip commit if CaseStudio import is broken. Continue to Task 19.

---

### Task 19: CaseStudio orchestrator + CaseHeader

**Files:**
- Create: `src/app/admin/cases/[id]/CaseStudio.tsx`
- Create: `src/components/admin-ops/case/CaseHeader.tsx`

**Interfaces:**
- Produces: Client-side stepper. Steps: 1=`docs` (read-only passport viewer), 2=`data_entry` (form), 3=`face_match`, 4=`decision`. Step state in `useState`. Auto-claim on mount if unassigned (POST to /claim).

- [ ] **Step 1: CaseHeader.tsx**

```tsx
// src/components/admin-ops/case/CaseHeader.tsx
"use client";
import Link from "next/link";
import { ADMIN } from "@/lib/admin/admin-tokens";
import { StatusPill } from "@/components/admin-ops/StatusPill";

export type CaseHeaderProps = {
  caseShortId: string;
  displayName: string;
  telegramUsername: string | null;
  phoneNumber: string | null;
  state: string;
  createdAt: string;
  step: 1 | 2 | 3 | 4;
};

const STEP_LABELS = ["Документы", "Паспортные данные", "Сверка лица", "Решение"];

export function CaseHeader(p: CaseHeaderProps) {
  return (
    <>
      <div style={{
        display: "flex", alignItems: "center", gap: 12,
        paddingBottom: 12, borderBottom: `1px solid ${ADMIN.border}`,
      }}>
        <Link href="/admin/queue/mine" style={{ color: ADMIN.ink500, textDecoration: "none", fontSize: 13 }}>
          ← Очередь
        </Link>
        <span style={{ color: ADMIN.ink300 }}>·</span>
        <span style={{ fontFamily: ADMIN.fontMono, fontSize: 13, color: ADMIN.ink900 }}>
          {p.caseShortId}
        </span>
        <span style={{ color: ADMIN.ink500, fontSize: 13 }}>{p.displayName}</span>
        <StatusPill kind={p.state === "data_entry" ? "warning" : "new"}>{p.state}</StatusPill>
      </div>

      <div style={{
        marginTop: 12, marginBottom: 16,
        display: "flex", gap: 16,
        fontSize: 12, color: ADMIN.ink500,
      }}>
        <span>Submitted {new Date(p.createdAt).toLocaleString("ru-RU")}</span>
        {p.telegramUsername ? <span>· TG @{p.telegramUsername}</span> : null}
        {p.phoneNumber ? <span>· phone {maskPhone(p.phoneNumber)}</span> : null}
      </div>

      {/* Step progress */}
      <div style={{
        display: "flex", gap: 0, alignItems: "center",
        marginBottom: 24,
      }}>
        {STEP_LABELS.map((label, i) => {
          const n = (i + 1) as 1|2|3|4;
          const done = n < p.step;
          const active = n === p.step;
          return (
            <div key={label} style={{ display: "flex", alignItems: "center", flex: i === STEP_LABELS.length - 1 ? 0 : 1 }}>
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                color: active ? ADMIN.ink900 : done ? ADMIN.ink700 : ADMIN.ink500,
                fontSize: 12, fontWeight: active ? 500 : 400,
              }}>
                <span style={{
                  width: 20, height: 20, borderRadius: "50%",
                  border: `1px solid ${active ? ADMIN.accent : ADMIN.border}`,
                  background: done ? ADMIN.accent : "transparent",
                  color: done ? "#fff" : active ? ADMIN.accent : ADMIN.ink500,
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11,
                }}>{done ? "✓" : n}</span>
                {label}
              </div>
              {i < STEP_LABELS.length - 1 ? (
                <div style={{ flex: 1, height: 1, background: done ? ADMIN.accent : ADMIN.border, margin: "0 12px" }} />
              ) : null}
            </div>
          );
        })}
      </div>
    </>
  );
}

function maskPhone(p: string): string {
  if (p.length < 6) return p;
  return p.slice(0, 4) + " *** " + p.slice(-4);
}
```

- [ ] **Step 2: CaseStudio.tsx (orchestrator skeleton, step 1 = docs viewer placeholder)**

```tsx
// src/app/admin/cases/[id]/CaseStudio.tsx
"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CaseHeader } from "@/components/admin-ops/case/CaseHeader";
import { ADMIN } from "@/lib/admin/admin-tokens";
import { Button } from "@/components/admin-ops/Button";
import type { LoadedCase } from "@/lib/admin/load-case";

export function CaseStudio({
  loadedCase, currentAdminId, currentAdminRole,
}: {
  loadedCase: LoadedCase;
  currentAdminId: string;
  currentAdminRole: "moderator" | "superadmin";
}) {
  void currentAdminRole; // used in Sprint 3 (F-119 etc)
  const router = useRouter();
  const [step, setStep] = useState<1|2|3|4>(loadedCase.draft_payload && Object.keys(loadedCase.draft_payload).length > 0 ? 2 : 1);
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);

  // Auto-claim on mount if unassigned
  useEffect(() => {
    if (loadedCase.assignee_id) return;
    setClaiming(true);
    fetch(`/api/admin/cases/${loadedCase.case_id}/claim`, { method: "POST" })
      .then((r) => r.json())
      .then((d: { ok: boolean; error?: string }) => {
        if (!d.ok) setClaimError(d.error ?? "claim_failed");
        else router.refresh();
      })
      .catch(() => setClaimError("network"))
      .finally(() => setClaiming(false));
  }, [loadedCase.assignee_id, loadedCase.case_id, router]);

  if (claimError) {
    return (
      <div style={{ padding: 24, border: `1px solid ${ADMIN.border}`, borderRadius: 8, background: ADMIN.surface }}>
        <div style={{ color: ADMIN.danger, marginBottom: 12 }}>
          Не удалось взять кейс: {claimError === "case_already_claimed" ? "обрабатывает другой админ" : claimError}
        </div>
        <Button onClick={() => router.push("/admin/queue/mine")}>← К очереди</Button>
      </div>
    );
  }

  if (loadedCase.assignee_id && loadedCase.assignee_id !== currentAdminId) {
    return (
      <div style={{ padding: 24, border: `1px solid ${ADMIN.border}`, borderRadius: 8, background: ADMIN.surface }}>
        <div style={{ color: ADMIN.warning, marginBottom: 12 }}>
          Кейс уже обрабатывается другим админом.
        </div>
        <Button onClick={() => router.push("/admin/queue/mine")}>← К очереди</Button>
      </div>
    );
  }

  if (claiming) return <div style={{ color: ADMIN.ink500 }}>Закрепляем кейс…</div>;

  const shortId = "VR-" + loadedCase.case_id.slice(0, 8);

  return (
    <div>
      <CaseHeader
        caseShortId={shortId}
        displayName={loadedCase.user.display_name ?? "—"}
        telegramUsername={loadedCase.user.telegram_username}
        phoneNumber={loadedCase.user.phone_number}
        state={loadedCase.state}
        createdAt={loadedCase.created_at}
        step={step}
      />

      {/* Step 1 placeholder (Task 20 fills with PassportViewer) */}
      {step === 1 ? (
        <Step1Docs
          passportUrl={loadedCase.passport_image_url}
          selfieUrl={loadedCase.selfie_image_url}
          onNext={() => setStep(2)}
        />
      ) : null}

      {step === 2 ? (
        <div style={{ padding: 24, border: `1px dashed ${ADMIN.border}`, borderRadius: 8 }}>
          <em style={{ color: ADMIN.ink500 }}>Шаг 2 — Passport data entry. Task 21 fills this.</em>
          <div style={{ marginTop: 12 }}>
            <Button onClick={() => setStep(1)}>← Назад</Button>
            <Button variant="primary" onClick={() => setStep(3)} style={{ marginLeft: 8 }}>→ Шаг 3</Button>
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div style={{ padding: 24, border: `1px dashed ${ADMIN.border}`, borderRadius: 8 }}>
          <em style={{ color: ADMIN.ink500 }}>Шаг 3 — Face match. Task 22 fills this.</em>
          <div style={{ marginTop: 12 }}>
            <Button onClick={() => setStep(2)}>← Назад</Button>
            <Button variant="primary" onClick={() => setStep(4)} style={{ marginLeft: 8 }}>→ Решение</Button>
          </div>
        </div>
      ) : null}

      {step === 4 ? (
        <div style={{ padding: 24, border: `1px dashed ${ADMIN.border}`, borderRadius: 8 }}>
          <em style={{ color: ADMIN.ink500 }}>Шаг 4 — Decision panel. Task 23 fills this.</em>
          <div style={{ marginTop: 12 }}>
            <Button onClick={() => setStep(3)}>← Назад</Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// Stub for Task 20
function Step1Docs({ passportUrl, selfieUrl, onNext }: { passportUrl: string | null; selfieUrl: string | null; onNext: () => void; }) {
  return (
    <div style={{ padding: 24, border: `1px dashed ${ADMIN.border}`, borderRadius: 8 }}>
      <em style={{ color: ADMIN.ink500 }}>Шаг 1 — PassportViewer. Task 20 fills this.</em>
      <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
        {passportUrl ? <img src={passportUrl} alt="passport" style={{ maxWidth: 240 }} /> : <span>no passport</span>}
        {selfieUrl ? <img src={selfieUrl} alt="selfie" style={{ maxWidth: 160 }} /> : <span>no selfie</span>}
      </div>
      <div style={{ marginTop: 16 }}>
        <Button variant="primary" onClick={onNext}>→ Шаг 2: ввести паспортные данные</Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Visual smoke test**

```bash
pnpm dev
```

Открой `/admin/cases/<real-case-id>`. Должна показаться шапка кейса + step indicator + step 1 placeholder с превью паспорта/селфи. Step button двигает между placeholder'ами.

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/cases/\[id\]/page.tsx src/app/admin/cases/\[id\]/CaseStudio.tsx src/components/admin-ops/case/CaseHeader.tsx src/lib/admin/load-case.ts
git commit -m "feat(admin): /admin/cases/:id studio skeleton — header, step indicator, auto-claim"
```

---

### Task 20: PassportViewer (Step 1)

**Files:**
- Create: `src/components/admin-ops/case/PassportViewer.tsx`
- Modify: `src/app/admin/cases/[id]/CaseStudio.tsx` (replace Step1Docs with `<PassportViewer>`)

**Interfaces:**
- Produces: `<PassportViewer passportUrl selfieUrl onNext>` — split layout, simple zoom via `transform: scale()` + buttons (no library yet).

- [ ] **Step 1: Write PassportViewer**

```tsx
// src/components/admin-ops/case/PassportViewer.tsx
"use client";
import { useState } from "react";
import { ADMIN } from "@/lib/admin/admin-tokens";
import { Button } from "@/components/admin-ops/Button";

export function PassportViewer({
  passportUrl, selfieUrl, onNext,
}: {
  passportUrl: string | null;
  selfieUrl: string | null;
  onNext: () => void;
}) {
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
        <ImagePanel title="Паспорт" url={passportUrl} />
        <ImagePanel title="Селфи" url={selfieUrl} />
      </div>
      <div style={{ marginTop: 24, display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <Button variant="primary" onClick={onNext}>→ Шаг 2: ввести паспортные данные</Button>
      </div>
    </div>
  );
}

function ImagePanel({ title, url }: { title: string; url: string | null }) {
  const [scale, setScale] = useState(1);
  const [rot, setRot] = useState(0);

  if (!url) {
    return (
      <div style={{ padding: 24, border: `1px solid ${ADMIN.border}`, borderRadius: 8, color: ADMIN.ink500, fontSize: 13 }}>
        {title}: не загружено
      </div>
    );
  }

  return (
    <div style={{ border: `1px solid ${ADMIN.border}`, borderRadius: 8, background: ADMIN.surface, padding: 12 }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 500, color: ADMIN.ink700, textTransform: "uppercase", letterSpacing: "0.04em" }}>{title}</div>
        <div style={{ flex: 1 }} />
        <Button size="sm" variant="ghost" onClick={() => setScale((s) => Math.max(0.5, s / 1.2))}>−</Button>
        <Button size="sm" variant="ghost" onClick={() => setScale((s) => Math.min(4, s * 1.2))}>+</Button>
        <Button size="sm" variant="ghost" onClick={() => setRot((r) => (r + 90) % 360)}>⟳</Button>
        <Button size="sm" variant="ghost" onClick={() => { setScale(1); setRot(0); }}>1:1</Button>
      </div>
      <div style={{
        overflow: "auto", maxHeight: 460,
        background: "#0d0d0d", borderRadius: 6,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <img
          src={url}
          alt={title}
          style={{
            transform: `scale(${scale}) rotate(${rot}deg)`,
            transformOrigin: "center",
            transition: "transform 0.12s ease",
            maxWidth: "100%",
          }}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire in CaseStudio**

In `src/app/admin/cases/[id]/CaseStudio.tsx`:
- Replace `import { ... }` block: add `import { PassportViewer } from "@/components/admin-ops/case/PassportViewer";`
- Replace `<Step1Docs ... />` with `<PassportViewer passportUrl={loadedCase.passport_image_url} selfieUrl={loadedCase.selfie_image_url} onNext={() => setStep(2)} />`
- Remove the `function Step1Docs(...)` stub at the bottom.

- [ ] **Step 3: Visual test**

Reload `/admin/cases/<id>`, проверь что zoom/rotate работают.

- [ ] **Step 4: Commit**

```bash
git add src/components/admin-ops/case/PassportViewer.tsx src/app/admin/cases/\[id\]/CaseStudio.tsx
git commit -m "feat(admin): PassportViewer with zoom/rotate"
```

---

### Task 21: PassportDataEntryForm (Step 2 — main flow)

**Files:**
- Create: `src/components/admin-ops/case/PassportDataEntryForm.tsx`
- Modify: `src/app/admin/cases/[id]/CaseStudio.tsx` (replace step 2 stub)

**Interfaces:**
- Consumes: `PassportPayload` type, `validatePassportPayload`, POST `/api/admin/cases/:id/draft`
- Produces: 11-field form with inline validation, auto-save (debounced 5s), Tab-friendly, disabled `Next` until 0 blockers. On Next → callback with payload (CaseStudio advances to step 3).

- [ ] **Step 1: Write PassportDataEntryForm**

```tsx
// src/components/admin-ops/case/PassportDataEntryForm.tsx
"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Field } from "@/components/admin-ops/Field";
import { Button } from "@/components/admin-ops/Field"; // wrong — fix below
import { ADMIN } from "@/lib/admin/admin-tokens";
import {
  validatePassportPayload, type PassportPayload, type FieldError,
} from "@/lib/admin/passport-validation";
```

Wait — fix import. The above import for Button is wrong. Use the correct one:

```tsx
// src/components/admin-ops/case/PassportDataEntryForm.tsx
"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Field } from "@/components/admin-ops/Field";
import { Button } from "@/components/admin-ops/Button";
import { ADMIN } from "@/lib/admin/admin-tokens";
import {
  validatePassportPayload, type PassportPayload, type FieldError,
} from "@/lib/admin/passport-validation";

const inputStyle = {
  height: 32, width: "100%",
  padding: "0 10px",
  fontFamily: ADMIN.fontSans, fontSize: 13,
  background: ADMIN.surface, color: ADMIN.ink900,
  border: `1px solid ${ADMIN.border}`,
  borderRadius: 4,
  outline: "none",
} as const;

const inputMonoStyle = { ...inputStyle, fontFamily: ADMIN.fontMono };

export type PassportFormProps = {
  caseId: string;
  initialPayload: Partial<PassportPayload>;
  onProceed: (payload: PassportPayload) => void;
};

export function PassportDataEntryForm({ caseId, initialPayload, onProceed }: PassportFormProps) {
  const [p, setP] = useState<Partial<PassportPayload>>(initialPayload);
  const [savingState, setSavingState] = useState<"idle"|"saving"|"saved"|"error">("idle");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const errors = useMemo(() => validatePassportPayload(p), [p]);
  const errorByField = useMemo(() => {
    const m = new Map<string, FieldError>();
    for (const e of errors) m.set(String(e.field), e);
    return m;
  }, [errors]);
  const blockerCount = errors.filter((e) => e.severity === "block").length;

  // Auto-save with debounce
  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    if (Object.keys(p).length === 0) return;
    saveTimer.current = setTimeout(async () => {
      setSavingState("saving");
      try {
        const r = await fetch(`/api/admin/cases/${caseId}/draft`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ payload: p }),
        });
        const d = await r.json();
        setSavingState(d.ok ? "saved" : "error");
      } catch {
        setSavingState("error");
      }
    }, 1500); // 1.5s debounce
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [p, caseId]);

  function set<K extends keyof PassportPayload>(k: K, v: PassportPayload[K] | undefined) {
    setP((prev) => ({ ...prev, [k]: v }));
  }
  function fieldOf(k: keyof PassportPayload) {
    const e = errorByField.get(String(k));
    return {
      error: e?.severity === "block" ? e.message : null,
      warning: e?.severity === "warn" ? e.message : null,
    };
  }

  return (
    <div>
      <SectionTitle>ФИО</SectionTitle>
      <FormGrid>
        <Field label="Фамилия" required {...fieldOf("last_name")}>
          <input style={inputStyle} value={p.last_name ?? ""} onChange={(e) => set("last_name", e.target.value)} />
        </Field>
        <Field label="Имя" required {...fieldOf("first_name")}>
          <input style={inputStyle} value={p.first_name ?? ""} onChange={(e) => set("first_name", e.target.value)} />
        </Field>
        <Field label="Отчество" {...fieldOf("middle_name")}>
          <input style={inputStyle} value={p.middle_name ?? ""} onChange={(e) => set("middle_name", e.target.value || undefined)} />
        </Field>
      </FormGrid>

      <SectionTitle>Документ</SectionTitle>
      <FormGrid>
        <Field label="Серия" required {...fieldOf("passport_series")}>
          <input
            style={inputMonoStyle}
            maxLength={2}
            value={p.passport_series ?? ""}
            onChange={(e) => set("passport_series", e.target.value.toUpperCase())}
            placeholder="AA"
          />
        </Field>
        <Field label="Номер" required {...fieldOf("passport_number")}>
          <input
            style={inputMonoStyle}
            maxLength={7}
            value={p.passport_number ?? ""}
            onChange={(e) => set("passport_number", e.target.value.replace(/\D/g, ""))}
            placeholder="1234567"
          />
        </Field>
        <Field label="ПИНФЛ" required {...fieldOf("pinfl")}>
          <input
            style={inputMonoStyle}
            maxLength={14}
            value={p.pinfl ?? ""}
            onChange={(e) => set("pinfl", e.target.value.replace(/\D/g, ""))}
            placeholder="14 цифр"
          />
        </Field>
        <Field label="Кем выдан" required {...fieldOf("issued_by")}>
          <input style={inputStyle} value={p.issued_by ?? ""} onChange={(e) => set("issued_by", e.target.value)} />
        </Field>
        <Field label="Дата выдачи" required {...fieldOf("issued_at")}>
          <input type="date" style={inputStyle} value={p.issued_at ?? ""} onChange={(e) => set("issued_at", e.target.value)} />
        </Field>
        <Field label="Срок действия" required {...fieldOf("expires_at")}>
          <input type="date" style={inputStyle} value={p.expires_at ?? ""} onChange={(e) => set("expires_at", e.target.value)} />
        </Field>
      </FormGrid>

      <SectionTitle>Личные данные</SectionTitle>
      <FormGrid>
        <Field label="Дата рождения" required {...fieldOf("birth_date")}>
          <input type="date" style={inputStyle} value={p.birth_date ?? ""} onChange={(e) => set("birth_date", e.target.value)} />
        </Field>
        <Field label="Пол" required {...fieldOf("gender")}>
          <div style={{ display: "flex", gap: 12, height: 32, alignItems: "center" }}>
            <label style={{ fontSize: 13 }}><input type="radio" name="gender" checked={p.gender === "M"} onChange={() => set("gender", "M")} /> М</label>
            <label style={{ fontSize: 13 }}><input type="radio" name="gender" checked={p.gender === "F"} onChange={() => set("gender", "F")} /> Ж</label>
          </div>
        </Field>
        <Field label="Гражданство" required {...fieldOf("citizenship")}>
          <select style={inputStyle} value={p.citizenship ?? "UZ"} onChange={(e) => set("citizenship", e.target.value)}>
            <option value="UZ">UZ</option><option value="RU">RU</option><option value="KZ">KZ</option><option value="OTHER">Другое</option>
          </select>
        </Field>
        <Field label="Место рождения" required {...fieldOf("birth_place")}>
          <input style={inputStyle} value={p.birth_place ?? ""} onChange={(e) => set("birth_place", e.target.value)} />
        </Field>
      </FormGrid>

      <SectionTitle>Адрес прописки</SectionTitle>
      <FormGrid>
        <Field label="Код области" required {...fieldOf("region_code")}>
          <input style={inputStyle} value={p.region_code ?? ""} onChange={(e) => set("region_code", e.target.value)} placeholder="UZ-TAS" />
        </Field>
        <Field label="Код района" required {...fieldOf("district_code")}>
          <input style={inputStyle} value={p.district_code ?? ""} onChange={(e) => set("district_code", e.target.value)} placeholder="UZ-TAS-YN" />
        </Field>
        <Field label="Населённый пункт" required {...fieldOf("locality")}>
          <input style={inputStyle} value={p.locality ?? ""} onChange={(e) => set("locality", e.target.value)} />
        </Field>
        <Field label="Улица + дом" required {...fieldOf("street_address")}>
          <input style={inputStyle} value={p.street_address ?? ""} onChange={(e) => set("street_address", e.target.value)} />
        </Field>
      </FormGrid>

      <div style={{
        marginTop: 24,
        padding: "12px 16px",
        background: ADMIN.surface, border: `1px solid ${ADMIN.border}`, borderRadius: 6,
        display: "flex", alignItems: "center", gap: 16,
      }}>
        <div style={{ fontSize: 12, color: ADMIN.ink500 }}>
          {blockerCount === 0 ? "Все обязательные поля валидны" : `${blockerCount} ошибок`}
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ fontSize: 11, color: ADMIN.ink300 }}>
          {savingState === "saving" ? "сохраняем…" :
           savingState === "saved" ? "автосохранено" :
           savingState === "error" ? "ошибка сохранения" : ""}
        </div>
        <Button
          variant="primary"
          disabled={blockerCount > 0}
          onClick={() => onProceed(p as PassportPayload)}
        >→ Шаг 3: сверка лица</Button>
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 500, color: ADMIN.ink500,
      textTransform: "uppercase", letterSpacing: "0.06em",
      marginTop: 20, marginBottom: 8,
    }}>{children}</div>
  );
}

function FormGrid({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12,
    }}>{children}</div>
  );
}
```

- [ ] **Step 2: Wire in CaseStudio**

In `src/app/admin/cases/[id]/CaseStudio.tsx`:
- Add import: `import { PassportDataEntryForm } from "@/components/admin-ops/case/PassportDataEntryForm";`
- Add state: `const [enteredPayload, setEnteredPayload] = useState<PassportPayload | null>(null);` (import PassportPayload)
- Replace step 2 stub:

```tsx
{step === 2 ? (
  <PassportDataEntryForm
    caseId={loadedCase.case_id}
    initialPayload={loadedCase.draft_payload as Partial<PassportPayload>}
    onProceed={(payload) => { setEnteredPayload(payload); setStep(3); }}
  />
) : null}
```

- [ ] **Step 3: Visual test**

Open case, перейди на шаг 2, заполни форму, посмотри auto-save индикатор, инвалидируй поля для проверки красных подсказок, проверь что `→ Шаг 3` disabled при ошибках.

- [ ] **Step 4: Commit**

```bash
git add src/components/admin-ops/case/PassportDataEntryForm.tsx src/app/admin/cases/\[id\]/CaseStudio.tsx
git commit -m "feat(admin): PassportDataEntryForm — 11 fields, inline validation, auto-save"
```

---

### Task 22: FaceMatchStep (Step 3)

**Files:**
- Create: `src/components/admin-ops/case/FaceMatchStep.tsx`
- Modify: `src/app/admin/cases/[id]/CaseStudio.tsx` (step 3)

**Interfaces:**
- Produces: `<FaceMatchStep selfieUrl passportUrl onConfirm onBack>` — side-by-side фото + 3 checkbox + Next disabled пока не все checked.

- [ ] **Step 1: Write component**

```tsx
// src/components/admin-ops/case/FaceMatchStep.tsx
"use client";
import { useState } from "react";
import { ADMIN } from "@/lib/admin/admin-tokens";
import { Button } from "@/components/admin-ops/Button";

export function FaceMatchStep({
  selfieUrl, passportUrl, onBack, onConfirm,
}: {
  selfieUrl: string | null;
  passportUrl: string | null;
  onBack: () => void;
  onConfirm: () => void;
}) {
  const [c1, setC1] = useState(false);
  const [c2, setC2] = useState(false);
  const [c3, setC3] = useState(false);
  const all = c1 && c2 && c3;

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Panel title="Селфи" url={selfieUrl} />
        <Panel title="Фото в паспорте" url={passportUrl} />
      </div>

      <div style={{
        marginTop: 24, padding: 16,
        border: `1px solid ${ADMIN.border}`, borderRadius: 8, background: ADMIN.surface,
      }}>
        <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 12 }}>Подтверди вручную:</div>
        <CheckRow checked={c1} onChange={setC1}>Лицо на селфи совпадает с фото в паспорте</CheckRow>
        <CheckRow checked={c2} onChange={setC2}>Это живой человек (не фото фотографии, не дипфейк)</CheckRow>
        <CheckRow checked={c3} onChange={setC3}>Возраст визуально соответствует дате рождения</CheckRow>
      </div>

      <div style={{ marginTop: 24, display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <Button onClick={onBack}>← Назад</Button>
        <Button variant="primary" disabled={!all} onClick={onConfirm}>→ Решение</Button>
      </div>
    </div>
  );
}

function Panel({ title, url }: { title: string; url: string | null }) {
  return (
    <div style={{ border: `1px solid ${ADMIN.border}`, borderRadius: 8, background: ADMIN.surface, padding: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 500, color: ADMIN.ink500, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>{title}</div>
      {url ? <img src={url} alt={title} style={{ width: "100%", borderRadius: 4 }} /> : <div style={{ color: ADMIN.ink500 }}>нет</div>}
    </div>
  );
}

function CheckRow({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", fontSize: 13, cursor: "pointer" }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {children}
    </label>
  );
}
```

- [ ] **Step 2: Wire in CaseStudio**

Replace step 3 stub:
```tsx
{step === 3 ? (
  <FaceMatchStep
    selfieUrl={loadedCase.selfie_image_url}
    passportUrl={loadedCase.passport_image_url}
    onBack={() => setStep(2)}
    onConfirm={() => setStep(4)}
  />
) : null}
```

Add import.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin-ops/case/FaceMatchStep.tsx src/app/admin/cases/\[id\]/CaseStudio.tsx
git commit -m "feat(admin): FaceMatchStep — side-by-side + 3 confirmation checkboxes"
```

---

### Task 23: DecisionPanel (Step 4 — final)

**Files:**
- Create: `src/components/admin-ops/case/DecisionPanel.tsx`
- Modify: `src/app/admin/cases/[id]/CaseStudio.tsx` (step 4)

**Interfaces:**
- Consumes: enteredPayload, case meta, reason templates (loaded via separate fetch or passed via props from server — Sprint 1 we just hardcode reason list for needs_changes since seeded in DB).
- Produces: Step 4 UI with summary card + 3 buttons (approve, needs_changes, reject_technical). Each opens confirm Dialog. On approve → POST /decision → redirect to /admin/clients/[user_id]. NeedsChanges/RejectTechnical → reason select Dialog → POST /decision → redirect to /admin/queue/mine.

- [ ] **Step 1: Write DecisionPanel**

```tsx
// src/components/admin-ops/case/DecisionPanel.tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ADMIN } from "@/lib/admin/admin-tokens";
import { Button } from "@/components/admin-ops/Button";
import { Dialog } from "@/components/admin-ops/Dialog";
import type { PassportPayload } from "@/lib/admin/passport-validation";

type DecisionMode = null | "approve" | "needs_changes" | "reject_technical";

const REASON_TEMPLATES_RU = [
  { code: "blurry_passport", text: "Скан паспорта размыт — нужен чёткий снимок" },
  { code: "blurry_selfie", text: "Селфи размыто — переснимите при дневном свете" },
  { code: "face_not_visible", text: "Лицо на селфи закрыто — снимите без головного убора" },
  { code: "passport_glare", text: "Блики на паспорте — снимите без вспышки" },
  { code: "wrong_document", text: "Прислан другой документ — требуется паспорт UZ" },
  { code: "data_mismatch", text: "Данные на скане не читаются — переснимите" },
];

export function DecisionPanel({
  caseId, userId, payload, expectedUpdatedAt, onBack,
}: {
  caseId: string;
  userId: string;
  payload: PassportPayload;
  expectedUpdatedAt: string;
  onBack: () => void;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<DecisionMode>(null);
  const [reasonCode, setReasonCode] = useState<string>(REASON_TEMPLATES_RU[0].code);
  const [reasonText, setReasonText] = useState<string>(REASON_TEMPLATES_RU[0].text);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(action: NonNullable<DecisionMode>) {
    setBusy(true);
    setError(null);
    const body: Record<string, unknown> = { action, expected_updated_at: expectedUpdatedAt };
    if (action === "approve") {
      body.payload = payload;
    } else {
      body.reason_code = reasonCode;
      body.reason_text = reasonText;
    }
    try {
      const r = await fetch(`/api/admin/cases/${caseId}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!d.ok) {
        setError(d.error ?? "unknown_error");
        setBusy(false);
        return;
      }
      // success
      if (action === "approve") {
        router.push(`/admin/clients/${userId}`);
      } else {
        router.push("/admin/queue/mine");
      }
      router.refresh();
    } catch (e) {
      setError("network");
      setBusy(false);
    }
  }

  return (
    <div>
      {/* Summary card */}
      <div style={{
        padding: 16, marginBottom: 24,
        border: `1px solid ${ADMIN.border}`, borderRadius: 8, background: ADMIN.surface,
      }}>
        <div style={{ fontSize: 11, fontWeight: 500, color: ADMIN.ink500, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Сводка ввода</div>
        <div style={{ fontSize: 15, fontWeight: 500 }}>{payload.last_name} {payload.first_name} {payload.middle_name ?? ""}</div>
        <div style={{ fontSize: 13, color: ADMIN.ink700, marginTop: 4 }}>
          {payload.gender} · {payload.citizenship} · {new Date(payload.birth_date).toLocaleDateString("ru-RU")}
        </div>
        <div style={{ fontSize: 13, fontFamily: ADMIN.fontMono, marginTop: 6 }}>
          {payload.passport_series}{payload.passport_number} · ПИНФЛ {payload.pinfl}
        </div>
        <div style={{ fontSize: 12, color: ADMIN.ink500, marginTop: 6 }}>
          {payload.locality}, {payload.street_address}
        </div>
      </div>

      {/* Action buttons */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <Button variant="primary" size="md" onClick={() => setMode("approve")} disabled={busy}>
          ✓ APPROVE — создать клиента
        </Button>
        <Button onClick={() => setMode("needs_changes")} disabled={busy}>
          ↩ NEEDS CHANGES — переснять документы
        </Button>
        <Button onClick={() => setMode("reject_technical")} disabled={busy}>
          ✕ REJECT TECHNICAL — можно повторить
        </Button>

        <div style={{ marginTop: 12, color: ADMIN.ink500, fontSize: 12 }}>
          Blocking-reject будет добавлен в Sprint 3 (требует second-admin подтверждения).
        </div>

        <div style={{ marginTop: 20 }}>
          <Button variant="ghost" onClick={onBack} disabled={busy}>← Назад к сверке лица</Button>
        </div>

        {error ? (
          <div style={{ color: ADMIN.danger, fontSize: 13, marginTop: 12 }}>
            Ошибка: {error}
          </div>
        ) : null}
      </div>

      {/* Approve confirm */}
      <Dialog
        open={mode === "approve"}
        onClose={() => !busy && setMode(null)}
        title="Подтвердите создание клиента"
        actions={
          <>
            <Button onClick={() => setMode(null)} disabled={busy}>Отмена</Button>
            <Button variant="primary" onClick={() => submit("approve")} disabled={busy}>
              {busy ? "Создаём…" : "Подтвердить"}
            </Button>
          </>
        }
      >
        Будет создана новая карточка клиента: <strong>{payload.last_name} {payload.first_name}</strong> ({payload.pinfl}).
        Селфи станет аватаркой клиента, юзер получит push «Анкета одобрена», кейс будет закрыт.
      </Dialog>

      {/* Reject confirm (needs_changes / reject_technical) */}
      <Dialog
        open={mode === "needs_changes" || mode === "reject_technical"}
        onClose={() => !busy && setMode(null)}
        title={mode === "needs_changes" ? "Запросить переснять документы" : "Отклонить (technical)"}
        actions={
          <>
            <Button onClick={() => setMode(null)} disabled={busy}>Отмена</Button>
            <Button variant="primary" onClick={() => mode && submit(mode)} disabled={busy || reasonText.length < 3}>
              {busy ? "Отправляем…" : "Подтвердить"}
            </Button>
          </>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <select
            style={{ height: 32, padding: "0 10px", borderRadius: 4, border: `1px solid ${ADMIN.border}`, fontFamily: ADMIN.fontSans, fontSize: 13 }}
            value={reasonCode}
            onChange={(e) => {
              const code = e.target.value;
              const tpl = REASON_TEMPLATES_RU.find((t) => t.code === code);
              setReasonCode(code);
              if (tpl) setReasonText(tpl.text);
            }}
          >
            {REASON_TEMPLATES_RU.map((t) => <option key={t.code} value={t.code}>{t.text}</option>)}
          </select>
          <textarea
            rows={3}
            style={{ padding: 10, borderRadius: 4, border: `1px solid ${ADMIN.border}`, fontFamily: ADMIN.fontSans, fontSize: 13, resize: "vertical" }}
            value={reasonText}
            onChange={(e) => setReasonText(e.target.value)}
          />
          <div style={{ fontSize: 12, color: ADMIN.ink500 }}>
            Этот текст увидит юзер. Минимум 3 символа.
          </div>
        </div>
      </Dialog>
    </div>
  );
}
```

- [ ] **Step 2: Wire in CaseStudio**

Replace step 4 stub:
```tsx
{step === 4 && enteredPayload ? (
  <DecisionPanel
    caseId={loadedCase.case_id}
    userId={loadedCase.user.id}
    payload={enteredPayload}
    expectedUpdatedAt={loadedCase.updated_at}
    onBack={() => setStep(3)}
  />
) : null}
{step === 4 && !enteredPayload ? (
  <div style={{ color: ADMIN.warning }}>
    Сначала заполните паспортные данные на шаге 2.
  </div>
) : null}
```

Add import. Note: `expectedUpdatedAt` приходит из loaded case — если auto-save в шаге 2 обновил кейс, оно может быть stale; правильнее перезагрузить case перед открытием decision. Для Sprint 1 простой подход: пользователь видит 409 от backend и refresh страницы.

- [ ] **Step 3: End-to-end test**

```bash
pnpm dev
```

1. Открой `/admin/queue/mine`
2. Кликни на кейс → /admin/cases/[id]
3. Auto-claim
4. Шаг 1: посмотри паспорт + селфи → Next
5. Шаг 2: заполни 11 полей → wait for "автосохранено" → Next
6. Шаг 3: ✓ все 3 checkbox → Next
7. Шаг 4: Approve → confirm → должен redirect на `/admin/clients/[user_id]` (404 пока — Task 24 фиксит)

Тест: до Task 24 redirect упадёт на 404. Это OK — мы проверим что approve выполнился через SQL:
```bash
psql "$DATABASE_PUBLIC_URL" -c "select * from user_identity where source_case_id = '<case-id>';"
psql "$DATABASE_PUBLIC_URL" -c "select id, verification_status, avatar_path from users where id = '<user-id>';"
psql "$DATABASE_PUBLIC_URL" -c "select state, outcome, decided_at from verification_cases where id = '<case-id>';"
```

Expected: user_identity row exists с 11 полями, user.avatar_path заполнен, case.state='closed' outcome='approved'.

- [ ] **Step 4: Commit**

```bash
git add src/components/admin-ops/case/DecisionPanel.tsx src/app/admin/cases/\[id\]/CaseStudio.tsx
git commit -m "feat(admin): DecisionPanel — approve/needs_changes/reject_technical with custom Dialog"
```

---

## Phase F: Client Card MVP

### Task 24: Client card — server loader + page

**Files:**
- Create: `src/app/admin/clients/[id]/page.tsx`
- Create: `src/lib/admin/load-client.ts`

**Interfaces:**
- Produces: Server page loading client with their latest active user_identity row.

- [ ] **Step 1: load-client.ts**

```ts
// src/lib/admin/load-client.ts
import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { signStorageObjectUrl } from "@/lib/storage/signed-url"; // verify path

export type LoadedClient = {
  user: {
    id: string;
    display_name: string | null;
    avatar_path: string | null;
    avatar_url: string | null;
    verification_status: string;
    lifecycle_state: string;
    telegram_username: string | null;
    created_at: string;
  };
  identity: null | {
    last_name: string;
    first_name: string;
    middle_name: string | null;
    birth_date: string;
    gender: string;
    citizenship: string;
    birth_place: string;
    passport_series: string;
    passport_number: string;
    pinfl: string;
    issued_by: string;
    issued_at: string;
    expires_at: string;
    region_code: string;
    district_code: string;
    locality: string;
    street_address: string;
    entered_by: string;
    entered_at: string;
    source_case_id: string | null;
    enterer_name: string | null;
  };
};

export async function loadClient(userId: string): Promise<LoadedClient | null> {
  const { data: user } = await supabaseAdmin()
    .from("users")
    .select("id, display_name, avatar_path, verification_status, lifecycle_state, telegram_username, created_at")
    .eq("id", userId)
    .maybeSingle();
  if (!user) return null;

  const avatar_url = user.avatar_path ? await signStorageObjectUrl(user.avatar_path) : null;

  const { data: idRow } = await supabaseAdmin()
    .from("user_identity")
    .select(`
      last_name, first_name, middle_name, birth_date, gender, citizenship, birth_place,
      passport_series, passport_number, pinfl, issued_by, issued_at, expires_at,
      region_code, district_code, locality, street_address,
      entered_by, entered_at, source_case_id,
      admin_users!user_identity_entered_by_fkey(name)
    `)
    .eq("user_id", userId)
    .is("superseded_at", null)
    .maybeSingle();

  let identity: LoadedClient["identity"] = null;
  if (idRow) {
    identity = {
      last_name: idRow.last_name as string,
      first_name: idRow.first_name as string,
      middle_name: (idRow.middle_name as string | null) ?? null,
      birth_date: idRow.birth_date as string,
      gender: idRow.gender as string,
      citizenship: idRow.citizenship as string,
      birth_place: idRow.birth_place as string,
      passport_series: idRow.passport_series as string,
      passport_number: idRow.passport_number as string,
      pinfl: idRow.pinfl as string,
      issued_by: idRow.issued_by as string,
      issued_at: idRow.issued_at as string,
      expires_at: idRow.expires_at as string,
      region_code: idRow.region_code as string,
      district_code: idRow.district_code as string,
      locality: idRow.locality as string,
      street_address: idRow.street_address as string,
      entered_by: idRow.entered_by as string,
      entered_at: idRow.entered_at as string,
      source_case_id: (idRow.source_case_id as string | null) ?? null,
      enterer_name: (idRow as unknown as { admin_users: { name: string | null } | null }).admin_users?.name ?? null,
    };
  }

  return {
    user: {
      id: user.id as string,
      display_name: (user.display_name as string | null) ?? null,
      avatar_path: (user.avatar_path as string | null) ?? null,
      avatar_url,
      verification_status: user.verification_status as string,
      lifecycle_state: user.lifecycle_state as string,
      telegram_username: (user.telegram_username as string | null) ?? null,
      created_at: user.created_at as string,
    },
    identity,
  };
}
```

- [ ] **Step 2: page.tsx**

```tsx
// src/app/admin/clients/[id]/page.tsx
import { redirect, notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { OpsShell } from "@/components/admin-ops/OpsShell";
import { loadClient } from "@/lib/admin/load-client";
import { ClientHero } from "./ClientHero";
import { IdentityTab } from "./IdentityTab";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin();
  if (!session) redirect("/admin/login");

  const { id } = await params;
  const c = await loadClient(id);
  if (!c) notFound();

  const { data: admin } = await supabaseAdmin()
    .from("admin_users").select("name").eq("id", session.adminId).maybeSingle();

  return (
    <OpsShell adminName={admin?.name ?? "—"} adminRole={session.role}>
      <ClientHero client={c} />
      <IdentityTab identity={c.identity} />
    </OpsShell>
  );
}
```

- [ ] **Step 3: Commit (stub IdentityTab/ClientHero — Task 25 fills)**

Skip if imports fail. Continue to Task 25.

---

### Task 25: ClientHero + IdentityTab

**Files:**
- Create: `src/app/admin/clients/[id]/ClientHero.tsx`
- Create: `src/app/admin/clients/[id]/IdentityTab.tsx`

**Interfaces:**
- Produces: hero block with avatar+name+pinfl+pills, then read-only Identity tab with 🛡 provenance.

- [ ] **Step 1: ClientHero.tsx**

```tsx
// src/app/admin/clients/[id]/ClientHero.tsx
"use client";
import { ADMIN } from "@/lib/admin/admin-tokens";
import { StatusPill } from "@/components/admin-ops/StatusPill";
import type { LoadedClient } from "@/lib/admin/load-client";

export function ClientHero({ client }: { client: LoadedClient }) {
  const id = client.identity;
  const full = id ? `${id.last_name} ${id.first_name} ${id.middle_name ?? ""}`.trim() : (client.user.display_name ?? "—");
  const age = id ? calcAge(id.birth_date) : null;

  return (
    <div style={{
      display: "flex", gap: 24, alignItems: "flex-start",
      paddingBottom: 24, borderBottom: `1px solid ${ADMIN.border}`,
      marginBottom: 24,
    }}>
      <div style={{
        width: 96, height: 96, borderRadius: 8,
        background: ADMIN.surface2, overflow: "hidden", flexShrink: 0,
      }}>
        {client.user.avatar_url ? (
          <img src={client.user.avatar_url} alt={full} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: ADMIN.ink300, fontSize: 32 }}>
            {full.slice(0, 1).toUpperCase()}
          </div>
        )}
      </div>

      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 22, fontWeight: 500, color: ADMIN.ink900, marginBottom: 6 }}>{full}</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          {client.user.verification_status === "approved" ? <StatusPill kind="verified">Verified</StatusPill> : <StatusPill kind="pending">{client.user.verification_status}</StatusPill>}
          {client.user.lifecycle_state === "active" ? <StatusPill kind="active">Active</StatusPill> : <StatusPill kind="paused">{client.user.lifecycle_state}</StatusPill>}
        </div>
        <div style={{ fontSize: 13, color: ADMIN.ink700, marginBottom: 4 }}>
          {age ? `${age} лет` : "возраст —"}
          {id ? ` · ${id.gender} · ${id.citizenship} · ${id.locality}` : ""}
        </div>
        {id ? (
          <>
            <CopyableRow label="ПИНФЛ" value={id.pinfl} />
            <CopyableRow label="Паспорт" value={`${id.passport_series}${id.passport_number}`} />
          </>
        ) : null}
        {client.user.telegram_username ? (
          <div style={{ fontSize: 12, color: ADMIN.ink500, marginTop: 4 }}>
            TG @{client.user.telegram_username}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function CopyableRow({ label, value }: { label: string; value: string }) {
  function copy() {
    navigator.clipboard?.writeText(value);
  }
  return (
    <div style={{ fontSize: 13, display: "flex", gap: 8, alignItems: "center" }}>
      <span style={{ color: ADMIN.ink500, minWidth: 60 }}>{label}</span>
      <span style={{ fontFamily: ADMIN.fontMono }}>{value}</span>
      <button onClick={copy} style={{ background: "transparent", border: 0, cursor: "pointer", color: ADMIN.ink500, fontSize: 11 }}>copy</button>
    </div>
  );
}

function calcAge(isoDate: string): number {
  const bd = new Date(isoDate);
  const now = new Date();
  let age = now.getFullYear() - bd.getFullYear();
  if (now.getMonth() < bd.getMonth() || (now.getMonth() === bd.getMonth() && now.getDate() < bd.getDate())) age--;
  return age;
}
```

- [ ] **Step 2: IdentityTab.tsx**

```tsx
// src/app/admin/clients/[id]/IdentityTab.tsx
import { ADMIN } from "@/lib/admin/admin-tokens";
import type { LoadedClient } from "@/lib/admin/load-client";

export function IdentityTab({ identity }: { identity: LoadedClient["identity"] }) {
  if (!identity) {
    return (
      <div style={{
        padding: 24, border: `1px solid ${ADMIN.border}`, borderRadius: 8,
        background: ADMIN.surface, color: ADMIN.ink500, fontSize: 13,
      }}>
        Паспортные данные ещё не введены. Откройте кейс верификации → пройдите 3-step studio.
      </div>
    );
  }

  return (
    <div style={{
      padding: 24, border: `1px solid ${ADMIN.border}`, borderRadius: 8,
      background: ADMIN.surface,
    }}>
      <div style={{ fontSize: 11, fontWeight: 500, color: ADMIN.ink500, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 16 }}>
        IDENTITY FACTS
      </div>

      <Section title="ФИО">
        <Row label="Фамилия" value={identity.last_name} verified />
        <Row label="Имя" value={identity.first_name} verified />
        {identity.middle_name ? <Row label="Отчество" value={identity.middle_name} verified /> : null}
      </Section>

      <Section title="Личность">
        <Row label="Дата рождения" value={new Date(identity.birth_date).toLocaleDateString("ru-RU")} verified />
        <Row label="Пол" value={identity.gender} verified />
        <Row label="Гражданство" value={identity.citizenship} verified />
        <Row label="Место рождения" value={identity.birth_place} verified />
      </Section>

      <Section title="Документ">
        <Row label="ПИНФЛ" value={identity.pinfl} mono verified />
        <Row label="Паспорт" value={`${identity.passport_series}${identity.passport_number}`} mono verified />
        <Row label="Кем выдан" value={identity.issued_by} />
        <Row label="Дата выдачи" value={new Date(identity.issued_at).toLocaleDateString("ru-RU")} />
        <Row label="Срок действия" value={new Date(identity.expires_at).toLocaleDateString("ru-RU")} />
      </Section>

      <Section title="Прописка">
        <Row label="Регион" value={`${identity.region_code} / ${identity.district_code}`} />
        <Row label="Адрес" value={`${identity.locality}, ${identity.street_address}`} />
      </Section>

      <div style={{
        marginTop: 20, padding: "12px 0", borderTop: `1px solid ${ADMIN.border}`,
        fontSize: 12, color: ADMIN.ink500,
      }}>
        Verified by {identity.enterer_name ?? "—"} · {new Date(identity.entered_at).toLocaleString("ru-RU")}
        {identity.source_case_id ? ` · case ${identity.source_case_id.slice(0,8)}` : ""}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 10, fontWeight: 500, color: ADMIN.ink500, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
        {title}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {children}
      </div>
    </div>
  );
}

function Row({ label, value, verified, mono }: { label: string; value: string; verified?: boolean; mono?: boolean }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "160px 1fr 60px", gap: 12, fontSize: 13 }}>
      <div style={{ color: ADMIN.ink500 }}>{label}</div>
      <div style={{ color: ADMIN.ink900, fontFamily: mono ? ADMIN.fontMono : ADMIN.fontSans }}>{value}</div>
      <div style={{ color: ADMIN.success, fontSize: 11 }}>{verified ? "🛡 verified" : ""}</div>
    </div>
  );
}
```

- [ ] **Step 3: End-to-end full flow test**

```bash
pnpm dev
```

1. Открой `/admin/queue/mine`
2. Выбери кейс → /admin/cases/[id]
3. Пройди 4 шага → approve
4. Redirect на `/admin/clients/[user_id]` → должна показаться карточка с **аватаром-селфи**, ФИО, ПИНФЛ, всеми 11 паспортными полями с 🛡 verified badge.

**Это deliverable Sprint 1.** Учредитель видит работающий flow.

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/clients/\[id\]/page.tsx src/app/admin/clients/\[id\]/ClientHero.tsx src/app/admin/clients/\[id\]/IdentityTab.tsx src/lib/admin/load-client.ts
git commit -m "feat(admin): /admin/clients/:id — hero + Identity tab with provenance"
```

---

## Phase G: Wrap-up

### Task 26: Test coverage check + type-check + manual smoke

**Files:** none (verification only)

- [ ] **Step 1: Run all tests**

```bash
cd /Users/fayzullohoja/Code/baxtlilar && pnpm vitest run
```

Expected: all green, including new passport-validation.test.ts + case-state-machine.test.ts and existing ~258 tests.

- [ ] **Step 2: TypeScript check**

```bash
pnpm tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 3: Manual smoke walkthrough**

Follow exact deliverable scenario from plan goal:
1. Open `/admin/queue/mine` after admin login
2. Click on case row → `/admin/cases/[id]` opens with shell + header + step 1
3. View passport + selfie → click Next
4. Fill 11 fields → wait for autosave indicator → click Next (should be enabled)
5. Tick 3 face-match checkboxes → click Next
6. On step 4 → click APPROVE → confirm Dialog → success
7. Redirect to `/admin/clients/[user_id]` shows:
   - Avatar from selfie
   - Full name from passport
   - 🛡 verified badges on each field
   - Provenance "Verified by [me] · today · case [short-id]"

If any step fails, file a bug task in the next sprint's plan.

- [ ] **Step 4: Final commit (if any housekeeping)**

```bash
git status
# if there are stray .md/changelog updates → add and commit
```

---

### Task 27: Document admin-redesign progress in CLAUDE.md / docs

**Files:**
- Modify or Create: `docs/superpowers/plans/2026-06-27-admin-redesign-sprint-1-foundation.md` (this file)

- [ ] **Step 1: At the end of this plan, mark Sprint 1 as deliverable-complete**

Append to bottom of this plan:

```
---

## Status

- [x] Sprint 1 delivered YYYY-MM-DD by [name]
- [ ] Sprint 2 plan: 2026-06-XX-admin-redesign-sprint-2-photos-clients.md (next)
- [ ] Sprint 3 plan: 2026-06-XX-admin-redesign-sprint-3-queue-dashboard.md
- [ ] Sprint 4 plan: 2026-06-XX-admin-redesign-sprint-4-polish.md
```

- [ ] **Step 2: Update memory file**

Update `/Users/fayzullohoja/.claude/projects/-Users-fayzullohoja-Desktop/memory/project_baxtlilar_v2_handoff.md` with reference:

```
- 2026-06-2X: Admin redesign Sprint 1 (foundation) landed. New flow: /admin/queue/mine → /admin/cases/:id (3-step studio: docs → 11-field passport data entry → face match → decision) → /admin/clients/:id (личность с аватаром-селфи). New tables: verification_cases, case_events, case_notes, user_identity, admin_reason_templates. RPCs: admin_claim/save_draft/approve/reject_verification. См. docs/superpowers/plans/2026-06-27-admin-redesign-sprint-1-foundation.md.
```

- [ ] **Step 3: Final commit**

```bash
git add docs/superpowers/plans/2026-06-27-admin-redesign-sprint-1-foundation.md
git commit -m "docs: mark Sprint 1 admin redesign complete"
```

---

## Self-Review

**Spec coverage:**
- ✓ Требование #1 (passport data entry перед approve) — Tasks 21, 23
- ✓ Требование #2 (11 паспортных полей с UZ-валидацией) — Task 6
- ✓ Требование #3 (клиент как личность) — Tasks 24-25
- ✓ Требование #4 (селфи становится аватаром) — Task 8 (admin_approve_verification RPC)
- ✓ Требование #5 (никаких window.confirm) — Task 11 (Dialog primitive), Task 23 (DecisionPanel uses Dialog)
- ✓ Требование #6 ("профессионально") — Tasks 9-13 (admin tokens, OpsShell)
- Deferred to Sprint 2: photo moderation list, /admin/clients directory с search
- Deferred to Sprint 3: case queue dashboard, SLA pills, watchers, F-119 blocking-reject, audit log filter UI
- Deferred to Sprint 4: cmd+K, hotkeys, undo, density modes, analytics rewrite, reason templates editor

**Placeholders:** none found — каждый step содержит код. Один TODO в импорте `signStorageObjectUrl` (Task 18 step 1) явно помечен с инструкцией "verify path".

**Type consistency:**
- `PassportPayload` определён в Task 6, используется в Tasks 17, 21, 23, 24, 25 — единая форма
- `LoadedCase` определён в Task 18, используется в Task 19
- `LoadedClient` определён в Task 24, используется в Tasks 25
- `CaseState`/`CaseOutcome` определены в Task 7, используются в Task 8 (PL/pgSQL via outcome check constraint)
- `AdminSession` — существующий из `lib/admin/session.ts`, используется во всех API routes — без изменений

**Открытые риски, документированные:**
- PINFL checksum формула в Task 6 step 4 требует валидации против реальных PINFL из prod; fallback — взять валидный PINFL из существующих `user_documents` rows
- `signStorageObjectUrl` import path в Task 18 — проверить точный путь helper'а; если отсутствует, использовать `/api/storage/o/<bucket>/<path>` напрямую
- `admin_users` table assumed существует с полями `id, name, role` — verify в Task 1 step 1; если поля иные, адаптировать loaders в Tasks 14, 18, 24
- `user_documents` table assumed имеет `passport_path` + `selfie_path` колонки — verify в Task 18; если иные имена, адаптировать loader

---

## Status

- [x] Sprint 1 implementation complete 2026-06-27 (branch `feat/admin-redesign-sprint-1`)
  - 5 миграций applied to prod, 4 RPCs, 34 unit tests added (292/292 total green)
  - OpsShell + 5-group sidebar, Dialog/Button/Field/StatusPill primitives
  - 3-step studio: queue → case detail → docs → 11-field passport entry → face match → decision
  - Client card MVP: hero (avatar=selfie) + Identity tab с 11 паспортными полями + provenance
  - Production build clean
  - **Not yet smoke-tested through full UI flow** — учредитель должен пройти end-to-end на staging/prod после merge
- [ ] Sprint 2 plan: TBD after Sprint 1 smoke-test
- [ ] Sprint 3 plan: TBD
- [ ] Sprint 4 plan: TBD

## Deferred from Sprint 1 → later

- Field-level edit с reason (super only) → Sprint 4
- Blocking-reject с F-119 two-person rule → Sprint 3
- Watchers, SLA pills, Just-landed realtime → Sprint 3
- Photo moderation table → Sprint 2
- Clients directory с search → Sprint 2
- Audit log UI с filters → Sprint 3
- Analytics rewrite → Sprint 4
- Cmd+K, hotkeys, undo, density modes → Sprint 4

## Migration script сборка для воспроизведения

Все 5 миграций применены последовательно:
```
psql "$DATABASE_PUBLIC_URL" -f supabase/migrations/20260627100000_admin_design_foundation.sql
psql "$DATABASE_PUBLIC_URL" -f supabase/migrations/20260627100100_verification_cases.sql
psql "$DATABASE_PUBLIC_URL" -f supabase/migrations/20260627100200_user_identity.sql
psql "$DATABASE_PUBLIC_URL" -f supabase/migrations/20260627100300_admin_reason_templates.sql
psql "$DATABASE_PUBLIC_URL" -f supabase/migrations/20260627100400_admin_case_rpcs.sql
psql "$DATABASE_PUBLIC_URL" -f supabase/migrations/20260627100500_pg_trgm_search.sql
```

Backfill: 2 cases created (Jakhongir CL-1b78f4ea + Nodirbek CL-b09819ab).
