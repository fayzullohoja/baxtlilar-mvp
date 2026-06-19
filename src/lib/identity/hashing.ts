import "server-only";
import crypto from "node:crypto";
import { env } from "@/lib/env";

// HMAC-SHA256-хеш телефона по SESSION_SECRET. Используется в phone_blacklist
// (F-006): храним хеш, не plaintext, чтобы дамп БД сам по себе не выдал список
// бывших пользователей. Префикс "phone:v1:" — domain-separation (тот же
// SESSION_SECRET используется и для cookies, и для start-token'а; префикс не
// даёт переиспользовать один хеш как другой).
const PHONE_NS = "phone:v1:";

export function hashPhone(phone: string): string {
  if (!phone) throw new Error("hashPhone: empty");
  const h = crypto.createHmac("sha256", env().SESSION_SECRET);
  h.update(PHONE_NS + phone);
  return h.digest("hex");
}

// SHA-256 байтов файла (passport/selfie). НЕ HMAC: хеш должен совпадать у
// одинаковых файлов между разными деплоями/инстансами (включая разные
// SESSION_SECRET'ы между средами), потому что цель — дедуп identity, а не
// тайна. Имеет смысл только для дедупа в admin-approve, не для приватности.
export function sha256Bytes(bytes: Uint8Array | ArrayBuffer | Buffer): string {
  const buf = bytes instanceof Uint8Array ? bytes : Buffer.from(bytes as ArrayBuffer);
  const h = crypto.createHash("sha256");
  h.update(buf);
  return h.digest("hex");
}
