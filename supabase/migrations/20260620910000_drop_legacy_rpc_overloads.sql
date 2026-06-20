-- H9+H10 verdict-fix (cleanup): убрать legacy overloads admin_blocking_reject
-- и admin_unblock_verification, которые принимают p_phone_hash снаружи.
-- Иначе JS-route или compromised admin может случайно вызвать старую
-- небезопасную сигнатуру (передав null/чужой hash).

drop function if exists admin_blocking_reject(
  p_user_id uuid,
  p_admin_id uuid,
  p_reason text,
  p_phone_hash text,
  p_phone_until_at timestamptz,
  p_passport_sha256 text,
  p_selfie_sha256 text,
  p_expected_updated_at timestamptz
);

drop function if exists admin_unblock_verification(
  p_user_id uuid,
  p_admin_id uuid,
  p_phone_hash text,
  p_expected_updated_at timestamptz
);
