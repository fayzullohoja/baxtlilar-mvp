import "server-only";
import { cookies } from "next/headers";
import crypto from "node:crypto";
import { env } from "@/lib/env";
import { safeEqual } from "@/lib/crypto/safe-equal";

const COOKIE = "bx_admin";
const MAX_AGE_SEC = 60 * 60 * 8; // 8 часов

export type AdminRole = "superadmin" | "moderator";
export type AdminSession = { adminId: string; role: AdminRole };

function sign(payload: string): string {
  return crypto.createHmac("sha256", env().SESSION_SECRET).update(payload).digest("base64url");
}

export async function setAdminSession(s: AdminSession): Promise<void> {
  const b64 = Buffer.from(JSON.stringify({ ...s, iat: Date.now() })).toString("base64url");
  const c = await cookies();
  c.set(COOKIE, `${b64}.${sign(b64)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SEC,
  });
}

export async function getAdminSession(): Promise<AdminSession | null> {
  const c = await cookies();
  const val = c.get(COOKIE)?.value;
  if (!val) return null;
  const [b64, sig] = val.split(".");
  if (!b64 || !sig || !safeEqual(sign(b64), sig)) return null;
  try {
    const p = JSON.parse(Buffer.from(b64, "base64url").toString("utf-8")) as Partial<AdminSession> & {
      iat?: number;
    };
    // ADM-4: серверная проверка срока — подписанная cookie живёт не дольше MAX_AGE_SEC
    if (typeof p.iat !== "number" || Date.now() - p.iat > MAX_AGE_SEC * 1000) return null;
    if (typeof p.adminId === "string" && (p.role === "superadmin" || p.role === "moderator")) {
      return { adminId: p.adminId, role: p.role };
    }
    return null;
  } catch {
    return null;
  }
}

export async function clearAdminSession(): Promise<void> {
  const c = await cookies();
  c.delete(COOKIE);
}
