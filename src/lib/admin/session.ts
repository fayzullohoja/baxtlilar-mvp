import "server-only";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import { packToken, unpackToken, type AdminRole, type AdminSession } from "./session-token";

export type { AdminRole, AdminSession };

const COOKIE = "bx_admin";
const MAX_AGE_SEC = 60 * 60 * 8; // 8 часов

// SEC-2c: промежуточная cookie между «пароль верный» и «TOTP введён».
// Короткоживущая (5 мин), НЕ даёт доступа — только помнит, кого мы аутентифицируем.
const PENDING_COOKIE = "bx_admin_totp";
const PENDING_MAX_AGE_SEC = 5 * 60;

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
} as const;

export async function setAdminSession(s: AdminSession): Promise<void> {
  const c = await cookies();
  c.set(COOKIE, packToken("admin", s, env().SESSION_SECRET), {
    ...COOKIE_OPTS,
    maxAge: MAX_AGE_SEC,
  });
}

export async function getAdminSession(): Promise<AdminSession | null> {
  const c = await cookies();
  const val = c.get(COOKIE)?.value;
  if (!val) return null;
  return unpackToken("admin", val, env().SESSION_SECRET, MAX_AGE_SEC);
}

export async function clearAdminSession(): Promise<void> {
  const c = await cookies();
  c.delete(COOKIE);
}

// ── SEC-2c: pending-TOTP (шаг между паролем и кодом) ──────────────────────────

export async function setPendingTotp(s: AdminSession): Promise<void> {
  const c = await cookies();
  c.set(PENDING_COOKIE, packToken("pending", s, env().SESSION_SECRET), {
    ...COOKIE_OPTS,
    maxAge: PENDING_MAX_AGE_SEC,
  });
}

export async function getPendingTotp(): Promise<AdminSession | null> {
  const c = await cookies();
  const val = c.get(PENDING_COOKIE)?.value;
  if (!val) return null;
  return unpackToken("pending", val, env().SESSION_SECRET, PENDING_MAX_AGE_SEC);
}

export async function clearPendingTotp(): Promise<void> {
  const c = await cookies();
  c.delete(PENDING_COOKIE);
}
