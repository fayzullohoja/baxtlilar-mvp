import "server-only";
import { cookies } from "next/headers";
import crypto from "node:crypto";
import { env } from "@/lib/env";

const COOKIE = "bx_session";
const MAX_AGE_SEC = 60 * 60 * 24 * 30; // 30 дней

function sign(payload: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("base64url");
}

export async function setSession(userId: string): Promise<void> {
  const e = env();
  const payload = JSON.stringify({ uid: userId, iat: Date.now() });
  const b64 = Buffer.from(payload).toString("base64url");
  const sig = sign(b64, e.SESSION_SECRET);
  const c = await cookies();
  c.set(COOKIE, `${b64}.${sig}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SEC,
  });
}

export async function getSessionUserId(): Promise<string | null> {
  const c = await cookies();
  const val = c.get(COOKIE)?.value;
  if (!val) return null;
  const [b64, sig] = val.split(".");
  if (!b64 || !sig) return null;
  const e = env();
  if (sign(b64, e.SESSION_SECRET) !== sig) return null;
  try {
    const payload = JSON.parse(Buffer.from(b64, "base64url").toString("utf-8")) as {
      uid?: unknown;
      iat?: unknown;
    };
    // протухание: сессия живёт не дольше MAX_AGE_SEC (cookie maxAge можно обойти — проверяем сами)
    if (typeof payload.iat === "number" && Date.now() - payload.iat > MAX_AGE_SEC * 1000) return null;
    return typeof payload.uid === "string" ? payload.uid : null;
  } catch {
    return null;
  }
}

export async function clearSession(): Promise<void> {
  const c = await cookies();
  c.delete(COOKIE);
}
