-- =============================================================================
-- §11 «Здоровье и особые обстоятельства» (ревью оунера 2026-07-14)
--
-- Новый onboarding-шаг profile_health между profile_lifestyle (Экран 10) и
-- profile_marriage. Данные шага — целиком COLD в user_profiles.extended.health
-- (открытость к здоровью + готовность к добров. медпроверке), поэтому НИКАКИХ
-- новых колонок: только значение enum.
--
-- Без этого значения UPDATE users SET onboarding_step='profile_health' падает
-- жёсткой ошибкой Postgres (нет fail-safe) → весь поток встаёт (история с
-- profile_finance/profile_parents). ПРИМЕНЯТЬ ПЕРВЫМ, до деплоя кода.
--
-- ALTER TYPE ADD VALUE не работает внутри транзакции в pooler-подключениях —
-- инструкция standalone (autocommit), идемпотентна благодаря IF NOT EXISTS.
-- =============================================================================

ALTER TYPE onboarding_step ADD VALUE IF NOT EXISTS 'profile_health';
