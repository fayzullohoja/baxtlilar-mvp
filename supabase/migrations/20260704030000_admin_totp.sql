-- SEC-2a — TOTP-поля для admin 2FA.
--   totp_secret         — активный base32-секрет; NULL = НЕ enrolled (login как
--                         раньше, без 2FA — self-safe: enforcement только для
--                         enrolled-аккаунтов, без глобального флипа/self-lockout);
--   totp_enrolled_at    — когда активирован;
--   totp_pending_secret — секрет на этапе enrollment (до подтверждения кодом).
--
-- Восстановление при потере устройства: суперадмин (или прямой доступ к БД)
-- обнуляет totp_secret — аккаунт снова логинится только паролем.
-- TODO(follow-up): шифровать totp_secret env-ключом (defense-in-depth при дампе БД).

alter table admin_users
  add column if not exists totp_secret text,
  add column if not exists totp_enrolled_at timestamptz,
  add column if not exists totp_pending_secret text;
