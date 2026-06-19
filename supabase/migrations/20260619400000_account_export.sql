-- 20260619400000_account_export.sql
-- F-118 (security-audit 2026-06-19): право на доступ субъекта ПД (ст. 25
-- закона РУз "О ПД"). Endpoint /api/account?action=export отдаёт JSON со всеми
-- данными пользователя. Rate-limit 1/24h, хранится в users.exported_at.

alter table users add column if not exists exported_at timestamptz;
