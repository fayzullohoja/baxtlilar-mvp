-- =============================================================================
-- Anketa V4 in-place migration (2026-07-01)
--
-- Источник: /Users/fayzullohoja/Desktop/Все файлы/02. Baxtlilar/01. Спека
-- (Чаты)/Чат 2 — Анкета.md + 13 учредительских поправок 2026-06-30.
--
-- Изменения структуры:
--   1. profile_basic: +district (text, nullable), +district_visible_public
--      (boolean, default false). Учредитель #1, #2, #3.
--   2. FAMILY_DECISION_MODEL: удалён `by_domain` (учредитель #7).
--   3. HOUSEHOLD_RESPONSIBILITY_MODEL: `flexible` → `mostly_partner` (gendered
--      label, учредитель #8). Rename value in-place через backfill.
--   4. POST_MARRIAGE_LIVING: `separate_near` → `separate` (учредитель #9).
--   5. valuesSchema.religion_practice стал .optional() (учредитель #5). Столбец
--      остаётся, ничего не удаляем — legacy данные сохраняем; UI form-поле
--      удалено в следующем коммите (Phase 1B).
--   6. Onboarding step swap: юзеры, застрявшие на `profile_appearance` или
--      `profile_birth_place`, — оставляем как есть (обе back-edges сохранены в
--      ALLOWED_TRANSITIONS для in-flight безопасности).
--   7. Новые шаги profile_finance, profile_lifestyle появляются между
--      family_model и marriage. Legacy юзеры, у которых сохранён
--      onboarding_step='profile_marriage' — двигаются вперёд как обычно
--      (finance/lifestyle это ОПЦИОНАЛЬНЫЕ шаги; forms заскочат только новые
--      published профили).
--   8. partner_extended: +partner_religion_match, +partner_preferred_countries.
--      Store в existing extended.partner JSONB.
--
-- Стратегия backfill: consumer-side default null; профили с недопустимыми
-- legacy значениями получают null (matching покрытие деградирует; UI
-- показывает мягкий баннер «уточните ответ» на next edit — см. следующий PR).
-- =============================================================================

BEGIN;

-- ============================================================================
-- 1. Новые колонки для basicSchema (district + visibility).
-- ============================================================================

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS district text,
  ADD COLUMN IF NOT EXISTS district_visible_public boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN user_profiles.district IS
  'V4 (2026-07-01): район проживания. Cascading select из UZ_DISTRICTS_BY_REGION '
  'для 6 покрытых регионов; freeform TextInput для остальных. '
  'Максимум 128 символов; nullable.';

COMMENT ON COLUMN user_profiles.district_visible_public IS
  'V4 (2026-07-01): показывать ли район в публичной анкете. По умолчанию FALSE — '
  'район виден только после взаимного интереса. Учредитель: «минимум инфо до match».';

-- ============================================================================
-- 2. Новые колонки для partner_extended (страны + религия партнёра).
-- ============================================================================

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS partner_religion_match text,
  ADD COLUMN IF NOT EXISTS partner_preferred_countries text[];

COMMENT ON COLUMN user_profiles.partner_religion_match IS
  'V4: переехало из values → partner-extended (учредитель: логично в «Кого ищу»). '
  'Значения: same_religion_same_practice | same_religion | mutual_respect. '
  'Оставлено в столбце для быстрого matching (не в extended JSONB).';

COMMENT ON COLUMN user_profiles.partner_preferred_countries IS
  'V4: multi-select из CITIZENSHIP (max 3). SOFT filter — matching ранжирует, '
  'но никогда не excluder (учредитель: «не делать жёстким фильтром»).';

-- ============================================================================
-- 3. Backfill deprecated enum values.
-- ============================================================================

-- 3.1 by_domain (учредитель #7) → NULL. Существующие профили с этим значением
-- потеряют вклад в matching family-decision-model сигнал до следующего редакта.
UPDATE user_profiles
   SET extended = jsonb_set(extended, '{family,decision_model}', 'null'::jsonb)
 WHERE extended->'family'->>'decision_model' = 'by_domain';

-- 3.2 flexible → mostly_partner (учредитель #8). Semantically closest replacement.
UPDATE user_profiles
   SET extended = jsonb_set(
         extended,
         '{family,household_responsibility_model}',
         to_jsonb('mostly_partner'::text)
       )
 WHERE extended->'family'->>'household_responsibility_model' = 'flexible';

-- 3.3 separate_near → separate (учредитель #9). Ближайшее semantic-совпадение.
UPDATE user_profiles
   SET post_marriage_living = 'separate'
 WHERE post_marriage_living = 'separate_near';

UPDATE user_profiles
   SET extended = jsonb_set(
         extended,
         '{living,future_format}',
         to_jsonb('separate'::text)
       )
 WHERE extended->'living'->>'future_format' = 'separate_near';

-- ============================================================================
-- 4. Onboarding step legacy migration.
-- ============================================================================
--
-- Юзеры на profile_looking_for → перекидываем на profile_partner_extended
-- (учредитель #10: logic looking-for absorbed into partner-extended).
UPDATE users
   SET onboarding_step = 'profile_partner_extended'
 WHERE onboarding_step = 'profile_looking_for';

-- ============================================================================
-- 5. Флаг ‘нуждается в ревизии’ для профилей затронутых backfill'ом.
-- ============================================================================
--
-- Это отдельная колонка чтобы фронт при следующем открытии /main показал
-- баннер «мы обновили варианты в анкете, уточните пару полей».
-- Читается ProgressiveProfile / MatchStoryCard.
--
-- Идемпотентно: NOT NULL default false; можно накатывать много раз.
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS needs_v4_review boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN user_profiles.needs_v4_review IS
  'V4 (2026-07-01): TRUE если профиль затронут backfill''ом enum-переименований '
  '(by_domain drop / flexible→mostly_partner / separate_near→separate). '
  'Фронт показывает мягкий баннер «уточните ответ»; после save баннер снимается.';

UPDATE user_profiles
   SET needs_v4_review = true
 WHERE post_marriage_living = 'separate' -- те что могли быть separate_near
    OR extended->'family'->>'household_responsibility_model' = 'mostly_partner'
    OR extended->'family'->>'decision_model' IS NULL AND
       -- только те у кого extended.family вообще заполнен (иначе false-positive):
       extended ? 'family';

-- ============================================================================
-- 6. Индексы для новых matching-сигналов.
-- ============================================================================

-- district используется в geo-matching (одинаковый район → сильный signal).
-- Индексируем ТОЛЬКО когда виден публично, иначе matching-хелпер не читает.
CREATE INDEX IF NOT EXISTS idx_user_profiles_district
  ON user_profiles(district)
  WHERE district IS NOT NULL AND district_visible_public = true;

-- GIN для partner_preferred_countries — matching использует && (array overlap).
CREATE INDEX IF NOT EXISTS idx_user_profiles_partner_countries
  ON user_profiles USING GIN (partner_preferred_countries)
  WHERE partner_preferred_countries IS NOT NULL;

COMMIT;

-- =============================================================================
-- ROLLBACK (для reference; не запускать в проде без причины):
-- =============================================================================
-- BEGIN;
--   ALTER TABLE user_profiles
--     DROP COLUMN IF EXISTS district,
--     DROP COLUMN IF EXISTS district_visible_public,
--     DROP COLUMN IF EXISTS partner_religion_match,
--     DROP COLUMN IF EXISTS partner_preferred_countries,
--     DROP COLUMN IF EXISTS needs_v4_review;
--   -- Backfill'ы enum'ов необратимы: «by_domain / flexible / separate_near»
--   -- удалены семантически; вернуть их без snapshot невозможно.
-- COMMIT;
