-- 20260619100000_bot_registration.sql
-- Phase B2 (security pivot 2026-06-19): бот-регистрация заменяет SMS OTP.
--
-- Новая воронка: bot_language → bot_contact → bot_consent_pd →
-- bot_consent_biometric → doc_upload → selfie_upload → moderation_pending → ...
--
-- Старые шаги enum (language, consent, phone_input, otp_pending) остаются как
-- dead code на случай реактивации унаследованных строк, но новых переходов на
-- них нет (см. src/lib/state-machine/transitions.ts ALLOWED_TRANSITIONS).
-- Таблица otp_codes/индексы — удаляются отдельной миграцией после успешного
-- релиза, чтобы откат был быстрым (не ALTER + рестор).

alter type onboarding_step add value if not exists 'bot_language';
alter type onboarding_step add value if not exists 'bot_contact';
alter type onboarding_step add value if not exists 'bot_consent_pd';
alter type onboarding_step add value if not exists 'bot_consent_biometric';

-- Стартовый шаг для новых пользователей — теперь bot_language.
alter table users alter column onboarding_step set default 'bot_language';

-- Доказательство согласия (F-013 / F-004 / P4 из security-audit 2026-06-19).
-- IP/UA фиксирует момент клика в боте; consent_text_sha256 — хеш текста, который
-- видел пользователь (защита от подмены LEGAL_VERSION→текст постфактум).
alter table consents
  add column if not exists ip text,
  add column if not exists user_agent text,
  add column if not exists language text,
  add column if not exists consent_text_sha256 text;

-- consents теперь поддерживает тип 'biometric' (отдельная категория ПД по
-- ст. 24 закона РУз "О ПД"). Проверка типов — в коде (не enum, текстовое поле).
