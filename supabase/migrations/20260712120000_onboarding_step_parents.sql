-- =============================================================================
-- Экран 6 «Родители и участие семьи» (2026-07-12)
--
-- Новый onboarding-шаг profile_parents между profile_family (Экран 5) и
-- profile_values. router.ts делает family → parents → values; transition()
-- пишет UPDATE users SET onboarding_step='profile_parents' — без этого значения
-- в enum весь поток встаёт на 409 (см. историю с profile_finance).
--
-- Данные шага — целиком COLD в user_profiles.extended.parents (отец/мать/семья +
-- _visibility-метаданные), поэтому НИКАКИХ новых колонок: только значение enum.
--
-- ALTER TYPE ADD VALUE не работает внутри транзакции в pooler-подключениях —
-- инструкция standalone, идемпотентна благодаря IF NOT EXISTS.
-- =============================================================================

ALTER TYPE onboarding_step ADD VALUE IF NOT EXISTS 'profile_parents';
