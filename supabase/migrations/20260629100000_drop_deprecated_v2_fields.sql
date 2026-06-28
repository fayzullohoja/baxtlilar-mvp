-- =====================================================================
-- Sprint 3 cleanup — DROP deprecated V2 поля
--
-- religion_importance (1-5 шкала) — заменена religion_practice (4 enum)
-- children_plan — заменён future_children_plan (5 V3 опций)
-- values text[] — заменён top_life_values text[] (14 опций V3)
-- employment — отдельной колонкой больше не используется (вынесено
--   на Экран 3 как employment_format, новый enum 5 опций)
--
-- Refactored consumers (см. PR):
-- - src/lib/v2/match-story.ts + .test.ts
-- - src/lib/v2/match-of-the-day.ts
-- - src/app/[locale]/v2/anketa/preview/page.tsx
-- - src/app/[locale]/v2/profile/[id]/page.tsx
-- - src/app/admin/clients/[id]/ProfileTab.tsx
-- - src/components/v2/RevealedProfile.tsx
-- - src/components/v2/ProgressiveProfile.tsx
-- - src/app/api/onboarding/profile/{family,values}/route.ts (убрали V2-compat)
--
-- Idempotent: DROP COLUMN IF EXISTS.
-- БД пуста после wipe — данных не теряем.
-- =====================================================================

BEGIN;

ALTER TABLE user_profiles DROP COLUMN IF EXISTS religion_importance;
ALTER TABLE user_profiles DROP COLUMN IF EXISTS children_plan;
ALTER TABLE user_profiles DROP COLUMN IF EXISTS values;
ALTER TABLE user_profiles DROP COLUMN IF EXISTS employment;

COMMIT;
