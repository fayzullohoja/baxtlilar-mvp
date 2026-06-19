// Origin allowlist для CSRF-защиты. Используется в proxy.ts на всех мутирующих
// (POST/PUT/PATCH/DELETE) запросах к /api/* и /admin/*.
//
// Контракт:
//  - Origin = web.telegram.org / k.web.telegram.org / a.web.telegram.org /
//    z.web.telegram.org → разрешено (TG Web mini-app в iframe).
//  - Origin = APP_URL host → разрешено (own origin).
//  - Origin = host из заголовка req → разрешено (dev, когда APP_URL не задан).
//  - Origin отсутствует → разрешено: нативный TG-клиент (iOS/Android/Desktop)
//    часто не шлёт Origin для запросов из WebApp. Это компромисс: классический
//    CSRF из браузера ВСЕГДА содержит Origin (даже text/plain), поэтому
//    отсутствие Origin = не-браузер = не CSRF.
//  - Origin = что-то ещё → ОТКАЗ.

const TELEGRAM_ORIGINS = new Set<string>([
  "https://web.telegram.org",
  "https://k.web.telegram.org",
  "https://a.web.telegram.org",
  "https://z.web.telegram.org",
]);

function originFromUrl(u: string | undefined): string | null {
  if (!u) return null;
  try {
    const url = new URL(u);
    return `${url.protocol}//${url.host}`;
  } catch {
    return null;
  }
}

export function isAllowedOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  // Нет Origin → не-браузер. CSRF-атаки из браузера всегда несут Origin.
  if (!origin) return true;

  if (TELEGRAM_ORIGINS.has(origin)) return true;

  const own = originFromUrl(process.env.APP_URL);
  if (own && origin === own) return true;

  // Dev / прокси-варианты: матчим по host-заголовку (https + http).
  const host = req.headers.get("host");
  if (host) {
    if (origin === `https://${host}` || origin === `http://${host}`) return true;
  }

  return false;
}
