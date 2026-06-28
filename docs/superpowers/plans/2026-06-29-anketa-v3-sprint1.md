# Sprint 1 — Anketa V3 MVP Foundation

**Дата:** 2026-06-28
**Срок Sprint 1:** ~4-5 рабочих дней
**Цель:** заложить DB-фундамент V3 анкеты + откатать end-to-end один новый экран как образец для Sprint 2.

---

## 1. Решения

### 1.1. Выбранный DB-подход: **Hybrid C (hot-columns + sparse JSONB)**

Поля, участвующие в matching/фильтрах/сортировке (gender, birth_date, city, height_cm, religion_practice, family_role_model, partner_age_min/max, top_life_values[], partner_top_qualities[], profile_visibility_mode и т.д.) — отдельные типизированные колонки в `user_profiles` с CHECK constraints и индексами. Редко-читаемые details для editorial-карточки (children.age_ranges, family.views[5], household_responsibility_model, separate_from_parents_importance и т.д.) — в одной jsonb-колонке `user_profiles.extended`. Один dev, V2-модель "1 рекомендация в день" + match story, прод после wipe (0 строк) — Hybrid даёт минимум миграций, не ломает уже закоммитнутый 0628-набор и сохраняет учредительскую поправку про `religion_practice` (4 опции БЕЗ шкалы) без переделок. Полные 4-5 доменных таблиц (вариант B) на MVP не окупаются; всё в плоской `user_profiles` (вариант A) через 2 спринта превратит её в 120-колоночного монстра.

### 1.2. Что в Sprint 1

| # | Скоуп | Артефакты |
|---|---|---|
| 1 | DB-миграция V3 (одна, идемпотентная) | `supabase/migrations/20260629000000_anketa_v3_hybrid.sql` |
| 2 | `options.ts` — новые enum-наборы (7 шт) | `src/lib/profile/options.ts` |
| 3 | `schemas.ts` — `extendedSchema` + `updateUserProfileV3()` helper | `src/lib/profile/schemas.ts` |
| 4 | State machine — 4 новых `onboarding_step` + ALLOW_TRANSITIONS | `src/lib/state-machine/{types,transitions}.ts` |
| 5 | Router — пути для новых экранов | `src/lib/state-machine/router.ts` |
| 6 | **Один** экран end-to-end: **Экран 2 «Место рождения»** | Form + API + page |
| 7 | Vitest: schemas, hot/cold split, transitions, миграция-idempotence | `src/**/__tests__/*` |
| 8 | E2E smoke на staging/prod | вручную по чек-листу из §5.3 |

### 1.3. Что в Sprint 2-3 (НЕ в Sprint 1)

- Экраны 3 / 5 / 6 / 8 / 12 / 16 — формы + API + страницы (каркас БД уже готов).
- Cleanup техдолга: deprecate `values` → `top_life_values`, `post_marriage_living` → `extended.living.future_format`, `geo_preference` → `extended.partner.location_preference`.
- Матчинг под новые поля (`family_role_model`, `top_life_values[]`, `partner_top_qualities[]`) — отдельный спринт после накопления данных.
- Bio-модерация (учредитель + Claude как ассистент).

### 1.4. Намеренно НЕ делаем (отложено учредителем)

| Экран | Решение |
|---|---|
| 9 (Финансы) | Доход в сумах опционально → пока **не делаем** ни поля, ни экран. |
| 10 (Образ жизни / привычки) | Откладывается целиком. |
| 11 (Родители) | Откладывается целиком. |
| 13 (Здоровье) | Health data — не в MVP. |
| 14 (Гео-предпочтения отдельным экраном) | `partner_location_preference` встраивается в Экран 8 (Sprint 2). |
| 15 (Доверенное лицо) | Откладывается. |
| 16 (Приватность) | Только **global** `profile_visibility_mode` (3 опции), per-block — нет. |
| OneID/MyID | Не интегрируем; остаётся паспорт + селфи + админ. |
| Религия | Шкала 1-5 из spec **игнорируется**, остаётся `religion_practice` (4 опции) от 28.06. |

---

## 2. Sprint 1 — DB migration

**Одна** миграция, ставится поверх `20260628100000_onboarding_v2_extension`.

### 2.1. Что делаем с устаревшими полями

Прод после wipe (0 строк) — **дроп безопасен прямо в этой миграции**:

- `religion_importance` — **DROP** (заменён `religion_practice`, поправка учредителя 28.06).
- `children_plan` — **DROP** (заменён `future_children_plan`).
- `values text[]` — **оставляем как deprecated alias до Sprint 2 cleanup**. Причина: в `getRecommendations` / `match-of-the-day` / outbox-payload могут быть ссылки; новый `top_life_values text[]` живёт параллельно, в Sprint 2 уберём `values` после миграции вызывающего кода.

> ⚠️ **Перед применением миграции:** убрать из `src/lib/matching/getRecommendations.ts` и из всех мест, где читается `religion_importance` / `children_plan`. Grep на эти имена должен дать 0 совпадений в `src/` (см. §7, Risk 5).

### 2.2. SQL миграции

**`supabase/migrations/20260629000000_anketa_v3_hybrid.sql`**

```sql
-- =====================================================================
-- Anketa V3 MVP Foundation — Hybrid (hot columns + sparse JSONB)
-- Поверх 20260628100000_onboarding_v2_extension
-- Idempotent: безопасно применять повторно
-- =====================================================================

BEGIN;

-- -----------------------------------------------------------------
-- 1. NEW HOT COLUMNS на user_profiles
-- -----------------------------------------------------------------

-- Экран 2 — место рождения
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS birth_country  text,
  ADD COLUMN IF NOT EXISTS birth_region   text,
  ADD COLUMN IF NOT EXISTS birth_district text,
  ADD COLUMN IF NOT EXISTS birth_city     text;

-- Экран 3 — деятельность и формат занятости
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS activity_field    text,
  ADD COLUMN IF NOT EXISTS employment_format text;

-- Экран 5 — дети (sentinel-поля; диапазоны и план-детали в extended)
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS children_count       int,
  ADD COLUMN IF NOT EXISTS youngest_child_age   int,
  ADD COLUMN IF NOT EXISTS future_children_plan text;

-- Экран 6 — ценности (новая колонка; values остаётся deprecated до Sprint 2)
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS top_life_values text[] NOT NULL DEFAULT '{}';

-- Экран 7 — семейная модель (только matching-критичные → колонки)
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS family_role_model            text,
  ADD COLUMN IF NOT EXISTS wife_work_after_marriage_view text;

-- Экран 8 — ожидания от партнёра
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS partner_height_min   int,
  ADD COLUMN IF NOT EXISTS partner_height_max   int,
  ADD COLUMN IF NOT EXISTS partner_top_qualities text[] NOT NULL DEFAULT '{}';

-- Экран 16 — глобальная видимость профиля
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS profile_visibility_mode text NOT NULL DEFAULT 'public';

-- Sparse-bucket для cold/редко-читаемых деталей
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS extended jsonb NOT NULL DEFAULT '{}'::jsonb;

-- -----------------------------------------------------------------
-- 2. CHECK constraints (через DO-блоки, идемпотентно)
-- -----------------------------------------------------------------

DO $$ BEGIN
  -- activity_field: 17 опций (см. options.ts → ACTIVITY_FIELDS)
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='user_profiles_activity_field_chk') THEN
    ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_activity_field_chk
      CHECK (activity_field IS NULL OR activity_field IN (
        'it_software','finance_banking','education_science','medicine_health',
        'state_service','law_legal','business_entrepreneurship','agriculture',
        'construction_realestate','manufacturing_industry','trade_retail',
        'transport_logistics','media_creative','services','religion_spiritual',
        'household_homemaker','other'
      ));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='user_profiles_employment_format_chk') THEN
    ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_employment_format_chk
      CHECK (employment_format IS NULL OR employment_format IN (
        'office','remote','hybrid','own_business','not_working'
      ));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='user_profiles_children_count_chk') THEN
    ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_children_count_chk
      CHECK (children_count IS NULL OR (children_count >= 0 AND children_count <= 10));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='user_profiles_youngest_child_age_chk') THEN
    ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_youngest_child_age_chk
      CHECK (youngest_child_age IS NULL OR (youngest_child_age >= 0 AND youngest_child_age <= 50));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='user_profiles_future_children_plan_chk') THEN
    ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_future_children_plan_chk
      CHECK (future_children_plan IS NULL OR future_children_plan IN (
        'yes_soon','yes_later','maybe','no','with_partner_decide'
      ));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='user_profiles_family_role_model_chk') THEN
    ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_family_role_model_chk
      CHECK (family_role_model IS NULL OR family_role_model IN (
        'traditional','equal_partnership','woman_leads','situational'
      ));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='user_profiles_wife_work_view_chk') THEN
    ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_wife_work_view_chk
      CHECK (wife_work_after_marriage_view IS NULL OR wife_work_after_marriage_view IN (
        'welcome','ok_if_needed','prefer_not','against','discuss'
      ));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='user_profiles_partner_height_chk') THEN
    ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_partner_height_chk
      CHECK (
        (partner_height_min IS NULL OR (partner_height_min BETWEEN 120 AND 230))
        AND (partner_height_max IS NULL OR (partner_height_max BETWEEN 120 AND 230))
        AND (partner_height_min IS NULL OR partner_height_max IS NULL OR partner_height_min <= partner_height_max)
      );
  END IF;

  -- top_life_values: 1..3, partner_top_qualities: 1..5
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='user_profiles_top_life_values_len_chk') THEN
    ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_top_life_values_len_chk
      CHECK (array_length(top_life_values, 1) IS NULL OR array_length(top_life_values, 1) BETWEEN 1 AND 3);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='user_profiles_partner_top_qualities_len_chk') THEN
    ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_partner_top_qualities_len_chk
      CHECK (array_length(partner_top_qualities, 1) IS NULL OR array_length(partner_top_qualities, 1) BETWEEN 1 AND 5);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='user_profiles_visibility_mode_chk') THEN
    ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_visibility_mode_chk
      CHECK (profile_visibility_mode IN ('public','verified_only','by_request'));
  END IF;

  -- birth_country: ISO-2 формата или 'UZ'; freeform до момента когда добавим справочник
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='user_profiles_birth_country_chk') THEN
    ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_birth_country_chk
      CHECK (birth_country IS NULL OR char_length(birth_country) BETWEEN 2 AND 64);
  END IF;
END $$;

-- -----------------------------------------------------------------
-- 3. DROP deprecated (данных = 0 → безопасно)
-- -----------------------------------------------------------------

ALTER TABLE user_profiles DROP COLUMN IF EXISTS religion_importance;
ALTER TABLE user_profiles DROP COLUMN IF EXISTS children_plan;
-- ПРИМЕЧАНИЕ: values text[] НЕ дропаем сейчас (Sprint 2 cleanup, см. §1.3)

-- -----------------------------------------------------------------
-- 4. INDEXES
-- -----------------------------------------------------------------

CREATE INDEX IF NOT EXISTS user_profiles_match_basic_idx
  ON user_profiles (status, gender, birth_date)
  WHERE status = 'published';

CREATE INDEX IF NOT EXISTS user_profiles_city_published_idx
  ON user_profiles (city)
  WHERE status = 'published';

CREATE INDEX IF NOT EXISTS user_profiles_religion_practice_idx
  ON user_profiles (religion_practice)
  WHERE status = 'published';

CREATE INDEX IF NOT EXISTS user_profiles_family_role_model_idx
  ON user_profiles (family_role_model)
  WHERE status = 'published';

CREATE INDEX IF NOT EXISTS user_profiles_visibility_idx
  ON user_profiles (profile_visibility_mode)
  WHERE status = 'published';

CREATE INDEX IF NOT EXISTS user_profiles_top_life_values_gin
  ON user_profiles USING GIN (top_life_values);

CREATE INDEX IF NOT EXISTS user_profiles_partner_top_qualities_gin
  ON user_profiles USING GIN (partner_top_qualities);

-- НЕТ индекса на extended jsonb до Sprint 2-3 (lazy add по требованию)

-- -----------------------------------------------------------------
-- 5. COMMENTS (для будущего dev'а и для матчинг-аудита)
-- -----------------------------------------------------------------

COMMENT ON COLUMN user_profiles.birth_country  IS 'Anketa Экран 2. Страна рождения. Не участвует в matching score; используется для editorial-карточки.';
COMMENT ON COLUMN user_profiles.birth_region   IS 'Anketa Экран 2. Регион рождения.';
COMMENT ON COLUMN user_profiles.birth_district IS 'Anketa Экран 2. Район рождения (для UZ).';
COMMENT ON COLUMN user_profiles.birth_city     IS 'Anketa Экран 2. Город рождения.';
COMMENT ON COLUMN user_profiles.activity_field IS 'Anketa Экран 3. 17 опций (см. options.ts/ACTIVITY_FIELDS). Может фильтроваться.';
COMMENT ON COLUMN user_profiles.employment_format IS 'Anketa Экран 3. office|remote|hybrid|own_business|not_working.';
COMMENT ON COLUMN user_profiles.children_count IS 'Anketa Экран 5. Количество детей (0..10).';
COMMENT ON COLUMN user_profiles.youngest_child_age IS 'Anketa Экран 5. Возраст младшего ребёнка (sentinel; полный список в extended.children.age_ranges).';
COMMENT ON COLUMN user_profiles.future_children_plan IS 'Anketa Экран 5. Заменяет deprecated children_plan.';
COMMENT ON COLUMN user_profiles.top_life_values IS 'Anketa Экран 6. 1-3 ценности. GIN-indexed. Используется в weighted match score (overlap).';
COMMENT ON COLUMN user_profiles.family_role_model IS 'Anketa Экран 7. traditional|equal_partnership|woman_leads|situational. Ключевой для matching.';
COMMENT ON COLUMN user_profiles.wife_work_after_marriage_view IS 'Anketa Экран 7. Взгляд на работу жены после брака.';
COMMENT ON COLUMN user_profiles.partner_height_min IS 'Anketa Экран 8. Нижняя граница роста партнёра в см.';
COMMENT ON COLUMN user_profiles.partner_height_max IS 'Anketa Экран 8. Верхняя граница роста партнёра в см.';
COMMENT ON COLUMN user_profiles.partner_top_qualities IS 'Anketa Экран 8. 1-5 ключевых качеств. GIN-indexed. Используется в weighted match score.';
COMMENT ON COLUMN user_profiles.profile_visibility_mode IS 'Anketa Экран 16. Глобальный режим видимости: public|verified_only|by_request. Per-block visibility в MVP нет.';
COMMENT ON COLUMN user_profiles.extended IS 'Sparse-bucket для cold-полей. Валидируется extendedSchema в src/lib/profile/schemas.ts. Не индексируется до появления реального фильтра.';

-- -----------------------------------------------------------------
-- 6. onboarding_step enum extension (новые шаги V3)
-- -----------------------------------------------------------------

DO $$ BEGIN
  BEGIN ALTER TYPE onboarding_step ADD VALUE IF NOT EXISTS 'profile_birth_place';   EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER TYPE onboarding_step ADD VALUE IF NOT EXISTS 'profile_self';          EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER TYPE onboarding_step ADD VALUE IF NOT EXISTS 'profile_family_model';  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER TYPE onboarding_step ADD VALUE IF NOT EXISTS 'profile_partner_extended'; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

COMMIT;
```

> ⚠️ **`ALTER TYPE ... ADD VALUE`** в Postgres ≤ 11 требует выполнения вне транзакции. На современных Supabase это работает в transaction block, но проверь локально через `supabase db reset` перед прод-пушем (см. §7, Risk 7).

---

## 3. Sprint 1 — Code changes

### 3.1. `src/lib/profile/options.ts` — новые enum-наборы

```ts
// === Экран 3 ===
export const ACTIVITY_FIELDS = [
  'it_software','finance_banking','education_science','medicine_health',
  'state_service','law_legal','business_entrepreneurship','agriculture',
  'construction_realestate','manufacturing_industry','trade_retail',
  'transport_logistics','media_creative','services','religion_spiritual',
  'household_homemaker','other',
] as const;
export type ActivityField = typeof ACTIVITY_FIELDS[number];

export const EMPLOYMENT_FORMAT = [
  'office','remote','hybrid','own_business','not_working',
] as const;
export type EmploymentFormat = typeof EMPLOYMENT_FORMAT[number];

// === Экран 5 ===
export const FUTURE_CHILDREN_PLAN = [
  'yes_soon','yes_later','maybe','no','with_partner_decide',
] as const;
export type FutureChildrenPlan = typeof FUTURE_CHILDREN_PLAN[number];

// === Экран 6 (top_life_values — справочник) ===
export const LIFE_VALUES = [
  'family','faith','honesty','respect','kindness','responsibility',
  'tradition','education','health','career','financial_stability',
  'community','self_development','independence',
] as const;
export type LifeValue = typeof LIFE_VALUES[number];

// === Экран 7 ===
export const FAMILY_ROLE_MODEL = [
  'traditional','equal_partnership','woman_leads','situational',
] as const;
export type FamilyRoleModel = typeof FAMILY_ROLE_MODEL[number];

export const WIFE_WORK_VIEW = [
  'welcome','ok_if_needed','prefer_not','against','discuss',
] as const;
export type WifeWorkView = typeof WIFE_WORK_VIEW[number];

// extended-only (но опции хранятся здесь же — единый SSOT)
export const FAMILY_DECISION_MODEL = [
  'husband_main','wife_main','joint','by_domain',
] as const;
export type FamilyDecisionModel = typeof FAMILY_DECISION_MODEL[number];

export const HOUSEHOLD_RESPONSIBILITY_MODEL = [
  'traditional','shared_50_50','by_skill','flexible',
] as const;
export type HouseholdResponsibilityModel = typeof HOUSEHOLD_RESPONSIBILITY_MODEL[number];

export const SEPARATE_FROM_PARENTS_IMPORTANCE = [
  'must','preferred','neutral','not_important',
] as const;
export type SeparateFromParentsImportance = typeof SEPARATE_FROM_PARENTS_IMPORTANCE[number];

// === Экран 8 ===
export const PARTNER_QUALITIES = [
  'kindness','honesty','responsibility','intelligence','sense_of_humor',
  'religiosity','ambition','calmness','loyalty','family_oriented',
  'caring','independence','generosity','patience',
] as const;
export type PartnerQuality = typeof PARTNER_QUALITIES[number];

// === Экран 16 ===
export const PROFILE_VISIBILITY_MODE = [
  'public','verified_only','by_request',
] as const;
export type ProfileVisibilityMode = typeof PROFILE_VISIBILITY_MODE[number];
```

### 3.2. `src/lib/profile/schemas.ts` — новые валидаторы

Добавить:

```ts
// === extended jsonb sub-schema (native validator, без zod) ===

import {
  FAMILY_DECISION_MODEL, HOUSEHOLD_RESPONSIBILITY_MODEL,
  SEPARATE_FROM_PARENTS_IMPORTANCE,
} from './options';

export const EXTENDED_SCHEMA_VERSION = 1;

export type ExtendedProfile = {
  _meta?: { schema_version: number; completed_at?: string };
  children?: {
    age_ranges?: number[];          // 0..50
    future_plan_details?: {
      timing?: string;
      count_preference?: number;    // 0..10
      conditions?: string;
    };
  };
  family?: {
    views?: string[];               // ровно 5 элементов в Экране 6
    decision_model?: typeof FAMILY_DECISION_MODEL[number];
    household_responsibility_model?: typeof HOUSEHOLD_RESPONSIBILITY_MODEL[number];
  };
  living?: {
    future_format?: string;         // расширенная версия post_marriage_living
    separate_from_parents_importance?: typeof SEPARATE_FROM_PARENTS_IMPORTANCE[number];
  };
  partner?: {
    location_preference?: {
      scope: 'same_city'|'same_region'|'same_country'|'any';
      cities?: string[];
    };
  };
  bio?: {
    hobbies?: string;
    about_family?: string;
  };
  privacy?: {
    // Зарезервировано для Sprint 2-3; в Sprint 1 не пишется.
    per_block?: Record<string, 'public'|'match_only'|'hidden'>;
  };
};

export function validateExtended(input: unknown): ExtendedProfile {
  if (input == null || typeof input !== 'object') throw new Error('extended must be object');
  const x = input as Record<string, any>;

  // Жёстко проверяем enum-поля; всё остальное — мягко (drop unknown keys).
  if (x.family?.decision_model
      && !FAMILY_DECISION_MODEL.includes(x.family.decision_model)) {
    throw new Error(`family.decision_model invalid: ${x.family.decision_model}`);
  }
  if (x.family?.household_responsibility_model
      && !HOUSEHOLD_RESPONSIBILITY_MODEL.includes(x.family.household_responsibility_model)) {
    throw new Error('family.household_responsibility_model invalid');
  }
  if (x.living?.separate_from_parents_importance
      && !SEPARATE_FROM_PARENTS_IMPORTANCE.includes(x.living.separate_from_parents_importance)) {
    throw new Error('living.separate_from_parents_importance invalid');
  }
  if (x.family?.views && (!Array.isArray(x.family.views) || x.family.views.length > 5)) {
    throw new Error('family.views must be array of <=5 strings');
  }
  if (x.children?.age_ranges) {
    if (!Array.isArray(x.children.age_ranges)) throw new Error('children.age_ranges must be array');
    for (const a of x.children.age_ranges) {
      if (typeof a !== 'number' || a < 0 || a > 50) throw new Error('children.age_ranges entry out of range');
    }
  }
  if (x.partner?.location_preference?.scope
      && !['same_city','same_region','same_country','any'].includes(x.partner.location_preference.scope)) {
    throw new Error('partner.location_preference.scope invalid');
  }
  return x as ExtendedProfile;
}

// === Экран 2 — Birth place schema ===
export type BirthPlacePayload = {
  birth_country: string;
  birth_region?: string;
  birth_district?: string;
  birth_city?: string;
};

export function validateBirthPlace(input: unknown): BirthPlacePayload {
  if (!input || typeof input !== 'object') throw new Error('payload required');
  const x = input as Record<string, unknown>;
  if (typeof x.birth_country !== 'string' || x.birth_country.length < 2 || x.birth_country.length > 64) {
    throw new Error('birth_country required (2..64 chars)');
  }
  const opt = (k: string) => {
    const v = x[k];
    if (v === undefined || v === null || v === '') return undefined;
    if (typeof v !== 'string' || v.length > 128) throw new Error(`${k} must be string <=128`);
    return v;
  };
  return {
    birth_country: x.birth_country,
    birth_region:   opt('birth_region'),
    birth_district: opt('birth_district'),
    birth_city:     opt('birth_city'),
  };
}

// === Hot/cold split helper (используется во всех API V3) ===

const HOT_COLUMNS = new Set([
  'birth_country','birth_region','birth_district','birth_city',
  'activity_field','employment_format',
  'children_count','youngest_child_age','future_children_plan',
  'top_life_values',
  'family_role_model','wife_work_after_marriage_view',
  'partner_height_min','partner_height_max','partner_top_qualities',
  'profile_visibility_mode',
]);

export function splitHotCold(payload: Record<string, unknown>) {
  const hot: Record<string, unknown> = {};
  const cold: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(payload)) {
    if (HOT_COLUMNS.has(k)) hot[k] = v;
    else cold[k] = v;
  }
  return { hot, cold };
}
```

### 3.3. State machine — `src/lib/state-machine/types.ts` + `transitions.ts`

**types.ts** — добавить в `OnboardingStep`:

```ts
export type OnboardingStep =
  | /* существующие */
  | 'profile_birth_place'
  | 'profile_self'
  | 'profile_family_model'
  | 'profile_partner_extended';
```

**transitions.ts** — расширить `ALLOW_TRANSITIONS` (точные позиции зависят от текущего графа; ниже — целевой порядок шагов анкеты V3 MVP):

```
profile_basic → profile_birth_place → profile_self → profile_photos
  → profile_family_children → profile_values_faith → profile_family_model
  → profile_partner_extended → profile_future_family → profile_privacy
  → profile_preview → profile_submitted → profile_published | profile_rejected
```

Sprint 1 целевые transitions реально нужны только два:

```ts
['profile_basic',       'profile_birth_place'],
['profile_birth_place', 'profile_self'],          // заглушка-переход; экран profile_self делаем в Sprint 2
```

Остальные новые переходы добавляются в Sprint 2 по мере появления экранов.

### 3.4. `src/lib/state-machine/router.ts` — пути экранов

```ts
const STEP_TO_PATH: Record<OnboardingStep, string> = {
  // ...
  profile_birth_place:      '/v2/anketa/birth-place',
  profile_self:             '/v2/anketa/self',              // Sprint 2
  profile_family_model:     '/v2/anketa/family-model',      // Sprint 2
  profile_partner_extended: '/v2/anketa/partner-extended',  // Sprint 2
};
```

---

## 4. Sprint 1 — UI scope

### 4.1. Один экран end-to-end: **Экран 2 — Место рождения**

**Обоснование выбора (Экран 2, а не Экран 7):**

| Критерий | Экран 2 (birth-place) | Экран 7 (family-model) |
|---|---|---|
| Hot vs hot+cold | Только hot-колонки | Hot + extended jsonb |
| Сложность UI | 4 поля, 2 каскадных селекта (country → region → district → city) | 4 enum-селектора + проверка целостности extended |
| Зависимость от cities.ts | Уже есть `src/lib/profile/cities.ts` (UZ) — переиспользуется | Не зависит |
| Risk поверхности | Низкий | Средний (тестируем hot/cold split + extendedSchema **одновременно** с UI) |
| Цель Sprint 1 | **Откатать flow**: миграция → schemas → state machine → API → форма → page | Та же |

**Экран 2 = идеальный smoke**: проверяем, что новые hot-колонки пишутся, transitions работают, страница рендерится через editorial v2 DNA. `extended` jsonb проверяем **только unit-тестами** на helper'е, без UI (UI для cold-полей придёт в Sprint 2 на Экране 7).

### 4.2. Артефакты Sprint 1 для Экрана 2

| Файл | Назначение |
|---|---|
| `src/components/v2/Anketa02BirthPlaceForm.tsx` | Форма с 4 полями (country, region, district, city). Editorial v2 DNA: paper/serif, inline styles + CSS vars. Native React state, без RHF/Zod. |
| `src/app/api/onboarding/profile/birth-place/route.ts` | POST → `loadUserForStep('profile_birth_place')` → `validateBirthPlace(body)` → `splitHotCold` (cold будет пуст) → один `UPDATE user_profiles SET birth_country=$1, ... WHERE user_id=$X` через `supabaseAdmin()` → `tryTransition('profile_birth_place','profile_self')` → 200. |
| `src/app/[locale]/v2/anketa/birth-place/page.tsx` | Server component: загружает профиль, рендерит `Anketa02BirthPlaceForm`. |

### 4.3. Sprint 1 НЕ трогает

- Welcome-серию.
- Существующие экраны (`profile_basic`, `profile_photos` и т.д.) — они работают на 0628-миграции.
- Экраны 3 / 5 / 6 / 7 / 8 / 12 / 16 (Sprint 2).

---

## 5. Тесты

### 5.1. Unit (Vitest)

**`src/lib/profile/__tests__/schemas-v3.test.ts`**

- `validateBirthPlace` принимает корректный payload (UZ + region + district + city).
- `validateBirthPlace` отклоняет: пустой `birth_country`, не-строка, `birth_city` > 128 символов.
- `validateExtended` принимает пустой объект `{}`.
- `validateExtended` принимает корректный `family.decision_model: 'joint'`.
- `validateExtended` отклоняет: `family.decision_model: 'foo'`, `family.views` массив длины 6, `children.age_ranges: [-1]`.
- Round-trip: `validateExtended(JSON.parse(JSON.stringify(sample))) === sample` для разных подмножеств.

**`src/lib/profile/__tests__/split-hot-cold.test.ts`**

- `splitHotCold({ birth_country:'UZ', family: { views: ['x'] } })` → hot содержит `birth_country`, cold содержит `family`.
- Все 16 hot-полей из `HOT_COLUMNS` корректно попадают в hot.
- Неизвестные ключи попадают в cold.

**`src/lib/state-machine/__tests__/transitions-v3.test.ts`**

- `tryTransition('profile_basic', 'profile_birth_place')` → ok.
- `tryTransition('profile_birth_place', 'profile_self')` → ok.
- `tryTransition('profile_birth_place', 'profile_published')` → reject.

### 5.2. Migration test (psql / supabase db reset)

Создать `supabase/tests/anketa_v3.sql` (или ручной чек-лист):

```sql
-- 1. Идемпотентность: применить миграцию дважды
\i supabase/migrations/20260629000000_anketa_v3_hybrid.sql
\i supabase/migrations/20260629000000_anketa_v3_hybrid.sql  -- не должно упасть

-- 2. Колонки на месте
SELECT column_name FROM information_schema.columns
WHERE table_name='user_profiles'
  AND column_name IN ('birth_country','extended','top_life_values',
                      'family_role_model','profile_visibility_mode');
-- ожидаем 5 строк

-- 3. Deprecated дропнуты
SELECT column_name FROM information_schema.columns
WHERE table_name='user_profiles'
  AND column_name IN ('religion_importance','children_plan');
-- ожидаем 0 строк

-- 4. CHECK constraints на месте
SELECT conname FROM pg_constraint
WHERE conname LIKE 'user_profiles_%_chk';
-- ожидаем 10+ строк

-- 5. INSERT + UPDATE с extended
INSERT INTO user_profiles (user_id, status, birth_country, top_life_values,
                           family_role_model, profile_visibility_mode, extended)
VALUES (gen_random_uuid(), 'draft', 'UZ', ARRAY['family','faith'],
        'traditional', 'public',
        '{"family":{"decision_model":"joint"},"_meta":{"schema_version":1}}'::jsonb);

-- 6. Неверный enum отбивается
INSERT INTO user_profiles (user_id, family_role_model)
VALUES (gen_random_uuid(), 'bogus');
-- ожидаем ERROR: check constraint user_profiles_family_role_model_chk
```

Запуск: `supabase db reset && psql $LOCAL_DB -f supabase/tests/anketa_v3.sql`.

### 5.3. E2E smoke на staging/prod (после деплоя)

1. Тестовый пользователь логинится → попадает в анкету.
2. Проходит `profile_basic` (existing flow).
3. На странице `/v2/anketa/birth-place` форма рендерится в editorial v2 стиле.
4. Заполнить birth_country = UZ, region/city → submit.
5. В БД: `SELECT birth_country, birth_region, birth_city, current_step FROM user_profiles WHERE user_id=$X` → значения записаны, `current_step = 'profile_self'`.
6. Браузер: 200 → редирект на `/v2/anketa/self` (даже если страница пока 404 — это ОК для Sprint 1, главное что transition прошёл).
7. В Sentry/runtime logs Vercel — 0 ошибок на роуте `birth-place`.
8. `supabaseAdmin().rpc(...)` или прямой SELECT: `religion_importance` колонки **нет** в проде → подтверждение DROP.

---

## 6. Что НЕ в Sprint 1

| Item | Куда |
|---|---|
| Bio модерация (LLM-ассист + админ review) | Отдельный sprint после Экрана 3 |
| Матчинг под новые поля (`family_role_model`, `top_life_values`, `partner_top_qualities`) | После накопления данных в проде (Sprint 3+) |
| Per-block privacy | Не в MVP; поле `extended.privacy.per_block` зарезервировано в `extendedSchema` для будущего |
| Cleanup `values` / `post_marriage_living` / `geo_preference` (deprecated aliases) | Sprint 2 cleanup-тикет |
| Bio-extra (`extended.bio.hobbies`, `about_family`) | Sprint 2 вместе с Экраном 3 |
| Sub-форма "Партнёр-локация" (`extended.partner.location_preference`) | Sprint 2 вместе с Экраном 8 |
| Backfill старых profile'ов | Не нужен (прод после wipe = 0 строк) |
| GIN на `extended` jsonb | Lazy: добавим когда появится фильтр |

---

## 7. Открытые вопросы во время реализации

### 7.1. Country picker для `birth_country` — справочник или freeform?

**Ситуация:** в БД `CHECK (char_length BETWEEN 2 AND 64)` — freeform. Но UI требует UX-решения: показывать ли список стран (ISO-3166), или просто 3 чипа "UZ / KZ / RU" + "Другая"?
**Гипотеза:** в MVP — 3 чипа + freeform fallback (баксы наши пользователи в основном UZ).
**Эскалация:** если в первые 100 анкет окажется >10% "Другая страна" — добавляем справочник в Sprint 2.

### 7.2. `top_life_values` в UI Экрана 6 (Sprint 2) — фиксированный список или freeform?

**Ситуация:** в `options.ts/LIFE_VALUES` уже есть 14 опций, но CHECK constraint в БД на содержимое массива нет (только на длину 1-3). Значит, теоретически можно записать произвольные строки.
**Решение Sprint 1:** оставляем БД мягкой; контроль на API-уровне через `validateLifeValuesArray`.
**Может всплыть:** учредитель захочет добавить "своё значение" → нужно решить, разрешаем ли custom или нет.

### 7.3. Переход `profile_birth_place → profile_self` — что показать пока экран `profile_self` не готов (Sprint 1 → Sprint 2 промежуток)?

**Варианты:**
- (A) Заглушка "Экран в разработке" с кнопкой "вернуться".
- (B) Не делать transition в Sprint 1, ставить заглушку `'profile_basic' → 'profile_birth_place' → 'profile_basic'` (петля).
- (C) Не пускать в `birth-place` без feature-флага, пока Sprint 2 не закроет `profile_self`.

**Рекомендация:** (A) — позволяет реально пройти flow в проде и собрать первые birth_place данные. Заглушка `/v2/anketa/self/page.tsx` = пустая страница с надписью "Следующий экран скоро будет доступен".

### 7.4. `ALTER TYPE onboarding_step ADD VALUE` в одной транзакции с DDL

**Риск:** на некоторых версиях Postgres (особенно ≤ 11, но иногда поведение менялось в 12-14) `ADD VALUE` нельзя в той же транзакции, где новое значение сразу используется. В нашей миграции мы не вставляем `INSERT ... 'profile_birth_place'` сразу — только ALTER TYPE, так что должно работать. **Но проверить локально через `supabase db reset` перед прод-пушем обязательно.**
**Fallback:** если упадёт — разнести на две миграции: `20260629000000_anketa_v3_hybrid.sql` (без ALTER TYPE) и `20260629000100_anketa_v3_enum_extension.sql` (только ALTER TYPE).

---

## Чек-лист Sprint 1 (порядок действий)

1. ☐ Grep `religion_importance` и `children_plan` в `src/` — должно быть 0 совпадений (фикс перед миграцией).
2. ☐ Grep этих же имён в `outbox_match_events` payload'ах (`SELECT payload FROM outbox_match_events WHERE payload::text ~ 'religion_importance'`).
3. ☐ Создать `supabase/migrations/20260629000000_anketa_v3_hybrid.sql` (§2.2).
4. ☐ `supabase db reset` локально + `\i supabase/tests/anketa_v3.sql` (§5.2).
5. ☐ Обновить `src/lib/profile/options.ts` (§3.1).
6. ☐ Обновить `src/lib/profile/schemas.ts` (§3.2).
7. ☐ Обновить `src/lib/state-machine/{types,transitions,router}.ts` (§3.3, §3.4).
8. ☐ Написать Vitest (§5.1) — должны проходить ДО реализации UI.
9. ☐ Создать `Anketa02BirthPlaceForm.tsx` + API route + page (§4.2).
10. ☐ Создать заглушку `src/app/[locale]/v2/anketa/self/page.tsx` (§7.3).
11. ☐ `vercel deploy` (preview) → smoke (§5.3).
12. ☐ Применить миграцию в проде, deploy в prod, повторить smoke.
13. ☐ Завести Sprint 2 cleanup-тикет (deprecate `values`, `post_marriage_living`, `geo_preference`) — до старта Sprint 2.

---

**Файлы, которые будут изменены/созданы в Sprint 1:**

- `/Users/fayzullohoja/<project>/supabase/migrations/20260629000000_anketa_v3_hybrid.sql` (новый)
- `/Users/fayzullohoja/<project>/supabase/tests/anketa_v3.sql` (новый)
- `/Users/fayzullohoja/<project>/src/lib/profile/options.ts` (изменение)
- `/Users/fayzullohoja/<project>/src/lib/profile/schemas.ts` (изменение)
- `/Users/fayzullohoja/<project>/src/lib/state-machine/types.ts` (изменение)
- `/Users/fayzullohoja/<project>/src/lib/state-machine/transitions.ts` (изменение)
- `/Users/fayzullohoja/<project>/src/lib/state-machine/router.ts` (изменение)
- `/Users/fayzullohoja/<project>/src/lib/profile/__tests__/schemas-v3.test.ts` (новый)
- `/Users/fayzullohoja/<project>/src/lib/profile/__tests__/split-hot-cold.test.ts` (новый)
- `/Users/fayzullohoja/<project>/src/lib/state-machine/__tests__/transitions-v3.test.ts` (новый)
- `/Users/fayzullohoja/<project>/src/components/v2/Anketa02BirthPlaceForm.tsx` (новый)
- `/Users/fayzullohoja/<project>/src/app/api/onboarding/profile/birth-place/route.ts` (новый)
- `/Users/fayzullohoja/<project>/src/app/[locale]/v2/anketa/birth-place/page.tsx` (новый)
- `/Users/fayzullohoja/<project>/src/app/[locale]/v2/anketa/self/page.tsx` (заглушка)