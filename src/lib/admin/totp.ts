import "server-only";
import crypto from "node:crypto";
import { safeEqual } from "@/lib/crypto/safe-equal";

/**
 * SEC-2 — TOTP (RFC 6238) hand-roll на node:crypto. Без внешних зависимостей.
 * HMAC-SHA1, шаг 30с, 6 цифр, окно ±1. Проверено тест-векторами RFC 6238.
 */

const B32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/** RFC 4648 base32 без паддинга, верхний регистр. */
export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32_ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

/** Декод base32; терпит пробелы, дефисы, паддинг и нижний регистр. */
export function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/[\s-]/g, "").replace(/=+$/, "");
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const ch of clean) {
    const idx = B32_ALPHABET.indexOf(ch);
    if (idx === -1) throw new Error("invalid base32 char");
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

/** HOTP/TOTP из сырого секрета: counter = floor(unixSeconds / step). */
export function totpFromBytes(
  secret: Buffer,
  unixSeconds: number,
  step = 30,
  digits = 6,
): string {
  const counter = Math.floor(unixSeconds / step);
  // 8-байтный big-endian счётчик
  const msg = Buffer.alloc(8);
  // счётчик < 2^53 — раскладываем через деление (побитовые операции в JS 32-бит)
  let c = counter;
  for (let i = 7; i >= 0; i--) {
    msg[i] = c & 0xff;
    c = Math.floor(c / 256);
  }
  const hmac = crypto.createHmac("sha1", secret).update(msg).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const bin =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  const code = bin % 10 ** digits;
  return code.toString().padStart(digits, "0");
}

/**
 * Проверка кода с окном дрейфа ±window шагов, constant-time сравнение.
 * secret — base32 (как хранится в admin_users.totp_secret).
 */
export function verifyTotp(
  secretB32: string,
  token: string,
  unixSeconds = Math.floor(Date.now() / 1000),
  window = 1,
  step = 30,
  digits = 6,
): boolean {
  if (!/^\d+$/.test(token) || token.length !== digits) return false;
  let secret: Buffer;
  try {
    secret = base32Decode(secretB32);
  } catch {
    return false;
  }
  for (let w = -window; w <= window; w++) {
    const expected = totpFromBytes(secret, unixSeconds + w * step, step, digits);
    if (safeEqual(expected, token)) return true;
  }
  return false;
}

/** Новый случайный секрет (20 байт = 160 бит), base32 для otpauth/QR. */
export function generateTotpSecret(): string {
  return base32Encode(crypto.randomBytes(20));
}

/** otpauth://-URI для QR (клиент рисует QR из этой строки). */
export function otpauthUri(secretB32: string, login: string, issuer = "Baxtlilar"): string {
  const label = encodeURIComponent(`${issuer}:${login}`);
  const params = new URLSearchParams({
    secret: secretB32,
    issuer,
    algorithm: "SHA1",
    digits: "6",
    period: "30",
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}
