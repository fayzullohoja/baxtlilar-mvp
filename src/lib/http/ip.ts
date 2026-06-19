import type { NextRequest } from "next/server";

// Минимальная IPv4-валидация; для IPv6 — проверка наличия двоеточия и
// разрешённого набора символов. Защита от чисел типа "[object Object]" или
// очевидно битых значений в throttle/audit-keys.
function isValidIpv4(s: string): boolean {
  const m = s.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  return m.slice(1).every((p) => Number(p) <= 255);
}

function isValidIp(s: string): boolean {
  if (isValidIpv4(s)) return true;
  // IPv6: "::1", "2001:db8::1", "fe80::%scope".
  return s.includes(":") && /^[0-9a-fA-F:.%]+$/.test(s);
}

function isPrivateIp(s: string): boolean {
  if (isValidIpv4(s)) {
    const [a, b] = s.split(".").map(Number);
    if (a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    return false;
  }
  const v = s.toLowerCase();
  if (v === "::1") return true;
  if (v.startsWith("fe80:")) return true; // link-local
  if (v.startsWith("fc") || v.startsWith("fd")) return true; // ULA
  return false;
}

/**
 * Доверенный IP клиента — пригодный для throttle-ключа и audit-IP.
 *
 * Контракт по платформам:
 * - **Railway**: edge (Envoy) ставит `X-Envoy-External-Address` в IP клиента;
 *   клиент подделать не может (заголовок выставляет сам Envoy, а не proxy'ит).
 * - **Vercel**: `X-Vercel-Forwarded-For` (первое значение = клиент по
 *   контракту edge), `X-Real-IP`, `X-Vercel-IP`.
 * - Fallback: правый сегмент `X-Forwarded-For` — его добавляет НАШ edge поверх
 *   входящих от клиента. Левые сегменты могут быть подделаны.
 *
 * Если ничего не найдено → `"unknown"` (fail-closed для throttle).
 *
 * Закрывает F-011 (audit 2026-06-19): на Railway раньше всегда возвращал
 * `"unknown"`, ломая admin-throttle и засоряя audit-IP.
 */
export function trustedIp(req: NextRequest | Request): string {
  const h = req.headers;

  // Railway / Envoy
  const envoy = h.get("x-envoy-external-address");
  if (envoy) {
    const ip = envoy.trim();
    if (isValidIp(ip)) return ip;
  }

  // Vercel
  const vercel = h.get("x-vercel-forwarded-for");
  if (vercel) {
    const first = vercel.split(",")[0]?.trim();
    if (first && isValidIp(first)) return first;
  }
  const vip = h.get("x-vercel-ip");
  if (vip) {
    const ip = vip.trim();
    if (isValidIp(ip)) return ip;
  }

  // Многие реверс-прокси (включая Railway в части настроек) ставят X-Real-IP.
  const real = h.get("x-real-ip");
  if (real) {
    const ip = real.trim();
    if (isValidIp(ip)) return ip;
  }

  // Last resort: правый сегмент XFF (последний trusted hop).
  // На Railway это даёт IP, который Envoy добавил поверх клиентского XFF.
  const xff = h.get("x-forwarded-for");
  if (xff) {
    const parts = xff
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      if (isValidIp(p) && !isPrivateIp(p)) return p;
    }
  }

  return "unknown";
}
