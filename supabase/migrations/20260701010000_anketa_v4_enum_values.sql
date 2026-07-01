-- =============================================================================
-- Anketa V4 enum values (2026-07-01 hotfix)
--
-- Дополнение к 20260701000000_anketa_v4_inplace.sql.
--
-- Оригинальная миграция забыла обновить сам ENUM-тип onboarding_step: она
-- добавила колонки/бэкфиллы, но новые значения perishable в TypeScript-типах не
-- были прописаны в Postgres. Как только юзер доходит до `profile_family_model`
-- и router.ts пытается перейти в `profile_finance`, Postgres кидает
-- `invalid input value for enum onboarding_step: "profile_finance"` и весь
-- анкета-poток встаёт.
--
-- ALTER TYPE ADD VALUE НЕ работает внутри транзакции в Postgres < 12 и в
-- pooler-подключениях — поэтому эта миграция вне BEGIN/COMMIT. Каждая
-- инструкция идемпотентна благодаря IF NOT EXISTS.
--
-- Также добавляем `profile_privacy` — он тоже отсутствовал в enum до этого
-- момента (было в TypeScript-union с Sprint 3 но забыли ADD VALUE).
-- =============================================================================

ALTER TYPE onboarding_step ADD VALUE IF NOT EXISTS 'profile_finance';
ALTER TYPE onboarding_step ADD VALUE IF NOT EXISTS 'profile_lifestyle';
ALTER TYPE onboarding_step ADD VALUE IF NOT EXISTS 'profile_privacy';
