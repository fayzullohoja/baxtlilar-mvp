import "server-only";
import crypto from "node:crypto";
import { env } from "@/lib/env";

// HMAC-подписанный one-time token, передаваемый из бота в мини-аппу через
// Telegram `start_param`. Формат: <b64url(payload)>.<b64url(sig)>.
// payload = { uid, iat }, sig = HMAC-SHA256(SESSION_SECRET, "starttoken:v1:"+payload).
// TTL 10 минут — внутри окна пользователь должен открыть мини-аппу.
// Используется в /api/auth/bootstrap для обмена токена на сессию.

const NS = "starttoken:v2:";
const TTL_SEC = 600;

// H3 verdict-fix: payload bind to telegram_id of the user, плюс уникальный jti.
// uid (БД user_id) ОДИН известен боту, telegram_id ДОЛЖЕН быть равен
// initData.user.id из bootstrap — токен без правильного tg-биндинга не пройдёт
// проверку. jti для single-use revocation через бутстрап-таблицу.
type Payload = { uid: string; tg: number; jti: string; iat: number };

function b64urlEncode(buf: Buffer): string {
  return buf.toString("base64url");
}

function b64urlDecode(s: string): Buffer {
  return Buffer.from(s, "base64url");
}

function sign(payloadB64: string): string {
  const h = crypto.createHmac("sha256", env().SESSION_SECRET);
  h.update(NS + payloadB64);
  return b64urlEncode(h.digest());
}

export function signStartToken(
  uid: string,
  telegramId: number,
  now: number = Math.floor(Date.now() / 1000),
): string {
  if (!uid) throw new Error("uid required");
  if (!telegramId) throw new Error("telegramId required");
  const jti = crypto.randomBytes(16).toString("base64url");
  const payload: Payload = { uid, tg: telegramId, jti, iat: now };
  const payloadB64 = b64urlEncode(Buffer.from(JSON.stringify(payload), "utf8"));
  const sig = sign(payloadB64);
  return `${payloadB64}.${sig}`;
}

export function verifyStartToken(
  token: string | undefined | null,
  now: number = Math.floor(Date.now() / 1000),
): { uid: string; tg: number; jti: string } | null {
  if (!token || typeof token !== "string") return null;
  const dot = token.indexOf(".");
  if (dot <= 0 || dot === token.length - 1) return null;
  const payloadB64 = token.slice(0, dot);
  const sigStr = token.slice(dot + 1);
  const expected = sign(payloadB64);
  if (expected.length !== sigStr.length) return null;
  try {
    if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sigStr))) return null;
  } catch {
    return null;
  }
  let payload: Payload;
  try {
    const raw = b64urlDecode(payloadB64).toString("utf8");
    payload = JSON.parse(raw) as Payload;
  } catch {
    return null;
  }
  if (!payload?.uid || typeof payload.uid !== "string") return null;
  if (typeof payload.tg !== "number" || !payload.tg) return null;
  if (typeof payload.jti !== "string" || !payload.jti) return null;
  if (!payload.iat) return null;
  const ageSec = now - payload.iat;
  if (ageSec < -5) return null;
  if (ageSec > TTL_SEC) return null;
  return { uid: payload.uid, tg: payload.tg, jti: payload.jti };
}
