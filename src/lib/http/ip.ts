import type { NextRequest } from "next/server";

/**
 * Доверенный IP клиента. На Vercel платформа проставляет x-vercel-forwarded-for / x-real-ip
 * по реально наблюдаемому на эдже адресу — их подделать клиентом нельзя (в отличие от сырого
 * x-forwarded-for, который шлёт сам клиент). Фикс ADM-2/SEC-2: НЕ доверяем левому сегменту XFF.
 */
export function trustedIp(req: NextRequest): string {
  const vercel = req.headers.get("x-vercel-forwarded-for");
  if (vercel) return vercel.split(",")[0]!.trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  const vip = req.headers.get("x-vercel-ip");
  if (vip) return vip.trim();
  // Локальная разработка / неизвестно — единый ключ (НЕ берём спуфабельный XFF как доверенный).
  return "unknown";
}
