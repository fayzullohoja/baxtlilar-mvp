-- =====================================================================
-- Anketa V3 MVP Foundation — Hybrid (hot columns + sparse JSONB)
-- Поверх 20260628100000_onboarding_v2_extension
-- Idempotent: безопасно применять повторно
--
-- ВНИМАНИЕ Sprint 1: DROP COLUMN religion_importance и children_plan
-- отложен в Sprint 2 — в коде есть 6 файлов с references (match-story,
-- match-of-the-day, preview, profile, admin, AnketaFamilyForm). Cleanup
-- придёт после refactor matching под новые поля.
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

-- Экран 5 — дети (sentinel-поля; диапазоны и детали плана в extended)
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

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='user_profiles_birth_country_chk') THEN
    ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_birth_country_chk
      CHECK (birth_country IS NULL OR char_length(birth_country) BETWEEN 2 AND 64);
  END IF;
END $$;

-- -----------------------------------------------------------------
-- 3. INDEXES для matching
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

-- -----------------------------------------------------------------
-- 4. COMMENTS (для будущего dev'а и для матчинг-аудита)
-- -----------------------------------------------------------------

COMMENT ON COLUMN user_profiles.birth_country  IS 'Anketa Экран 2. Страна рождения. Не участвует в matching score; используется для editorial-карточки.';
COMMENT ON COLUMN user_profiles.birth_region   IS 'Anketa Экран 2. Регион рождения.';
COMMENT ON COLUMN user_profiles.birth_district IS 'Anketa Экран 2. Район рождения (для UZ).';
COMMENT ON COLUMN user_profiles.birth_city     IS 'Anketa Экран 2. Город рождения.';
COMMENT ON COLUMN user_profiles.activity_field IS 'Anketa Экран 3. 17 опций (см. options.ts/ACTIVITY_FIELDS). Может фильтроваться.';
COMMENT ON COLUMN user_profiles.employment_format IS 'Anketa Экран 3. office|remote|hybrid|own_business|not_working.';
COMMENT ON COLUMN user_profiles.children_count IS 'Anketa Экран 5. Количество детей (0..10).';
COMMENT ON COLUMN user_profiles.youngest_child_age IS 'Anketa Экран 5. Возраст младшего ребёнка (sentinel; полный список в extended.children.age_ranges).';
COMMENT ON COLUMN user_profiles.future_children_plan IS 'Anketa Экран 5. Заменяет deprecated children_plan (drop в Sprint 2 после refactor matching).';
COMMENT ON COLUMN user_profiles.top_life_values IS 'Anketa Экран 6. 1-3 ценности. GIN-indexed. Используется в weighted match score (overlap).';
COMMENT ON COLUMN user_profiles.family_role_model IS 'Anketa Экран 7. traditional|equal_partnership|woman_leads|situational. Ключевой для matching.';
COMMENT ON COLUMN user_profiles.wife_work_after_marriage_view IS 'Anketa Экран 7. Взгляд на работу жены после брака.';
COMMENT ON COLUMN user_profiles.partner_height_min IS 'Anketa Экран 8. Нижняя граница роста партнёра в см.';
COMMENT ON COLUMN user_profiles.partner_height_max IS 'Anketa Экран 8. Верхняя граница роста партнёра в см.';
COMMENT ON COLUMN user_profiles.partner_top_qualities IS 'Anketa Экран 8. 1-5 ключевых качеств. GIN-indexed. Используется в weighted match score.';
COMMENT ON COLUMN user_profiles.profile_visibility_mode IS 'Anketa Экран 16. Глобальный режим видимости: public|verified_only|by_request. Per-block visibility в MVP нет.';
COMMENT ON COLUMN user_profiles.extended IS 'Sparse-bucket для cold-полей. Валидируется extendedSchema в src/lib/profile/schemas.ts. Не индексируется до появления реального фильтра.';

COMMIT;

-- -----------------------------------------------------------------
-- 5. onboarding_step enum extension — отдельной транзакцией
-- (ALTER TYPE ADD VALUE требует отдельный commit на некоторых версиях PG)
-- -----------------------------------------------------------------

ALTER TYPE onboarding_step ADD VALUE IF NOT EXISTS 'profile_birth_place';
ALTER TYPE onboarding_step ADD VALUE IF NOT EXISTS 'profile_self';
ALTER TYPE onboarding_step ADD VALUE IF NOT EXISTS 'profile_family_model';
ALTER TYPE onboarding_step ADD VALUE IF NOT EXISTS 'profile_partner_extended';
