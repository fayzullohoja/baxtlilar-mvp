import crypto from "node:crypto";
import { safeEqual } from "@/lib/crypto/safe-equal";

/**
 * Подпись/разбор админских токенов. Чистые функции без cookie-IO и env —
 * чтобы свойства безопасности проверялись unit-тестом, а не «на глаз».
 *
 * ⛔ SEC-2d (обход 2FA). Раньше подпись была HMAC(SECRET, b64) БЕЗ разделения
 * назначения, а `setAdminSession` и `setPendingTotp` писали ОДИНАКОВУЮ нагрузку
 * {adminId, role, iat}. Значит значение промежуточной куки `bx_admin_totp`
 * (выдаётся уже после ввода ПАРОЛЯ, но ДО второго фактора) можно было скопировать
 * в куку `bx_admin` — подпись сходилась, и получалась полноценная админ-сессия
 * без TOTP, да ещё на 8 часов вместо 5 минут. httpOnly не мешает: владелец
 * браузера правит куки в devtools.
 *
 * Фикс: подпись считается над `"<scope>:" + b64`. Токен, выпущенный для scope
 * "pending", математически не проходит проверку для scope "admin".
 */

export type AdminRole = "superadmin" | "moderator";
export type AdminSession = { adminId: string; role: AdminRole };

/** Назначение токена. Часть подписываемых данных — не взаимозаменяемы. */
export type TokenScope = "admin" | "pending";

function sign(scope: TokenScope, payloadB64: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(`${scope}:${payloadB64}`).digest("base64url");
}

/** Подписанный токен вида `<payload_b64>.<hmac>` для конкретного назначения. */
export function packToken(
  scope: TokenScope,
  s: AdminSession,
  secret: string,
  now: number = Date.now(),
): string {
  const b64 = Buffer.from(JSON.stringify({ ...s, iat: now })).toString("base64url");
  return `${b64}.${sign(scope, b64, secret)}`;
}

/**
 * Проверяет подпись ДЛЯ ЭТОГО scope и срок жизни. null — если токен чужого
 * назначения, подделан, просрочен или испорчен.
 */
export function unpackToken(
  scope: TokenScope,
  token: string,
  secret: string,
  maxAgeSec: number,
  now: number = Date.now(),
): AdminSession | null {
  const [b64, sig] = token.split(".");
  if (!b64 || !sig || !safeEqual(sign(scope, b64, secret), sig)) return null;
  try {
    const p = JSON.parse(Buffer.from(b64, "base64url").toString("utf-8")) as Partial<AdminSession> & {
      iat?: number;
    };
    // ADM-4: серверная проверка срока — подписанный токен живёт не дольше maxAgeSec.
    if (typeof p.iat !== "number" || now - p.iat > maxAgeSec * 1000) return null;
    if (typeof p.adminId === "string" && (p.role === "superadmin" || p.role === "moderator")) {
      return { adminId: p.adminId, role: p.role };
    }
    return null;
  } catch {
    return null;
  }
}
