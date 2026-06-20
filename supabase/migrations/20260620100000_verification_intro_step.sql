-- 20260620100000_verification_intro_step.sql
-- MAJOR #1 spec-Экран-5 (без OneID): промежуточный шаг между бот-flow и
-- загрузкой паспорта. Объясняет «зачем верификация» и снижает drop-off.
--
-- Single-statement: ALTER TYPE ADD VALUE требует коммита до использования
-- нового значения в любых DML. Никаких backfill — все живые юзеры либо в
-- bot-flow (не задеты), либо уже на doc_upload+ (минуют intro by design).
alter type onboarding_step add value if not exists 'verification_intro';
