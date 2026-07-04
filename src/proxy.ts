import createMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";
import { routing } from "@/i18n/routing";
import { isAllowedOrigin } from "@/lib/http/origin-check";
import { checkRateLimit } from "@/lib/http/rate-limit";
import { trustedIp } from "@/lib/http/ip";

// SEC-3b (частично): 12MB полезной нагрузки (лимит storage.ts) + запас на
// multipart-обвязку. Роуты дальше сами проверяют реальный буфер.
const MAX_BODY_BYTES = 13 * 1024 * 1024;

const intl = createMiddleware(routing);

// Пути, доступные анонимно (без bx_session cookie).
// /open-in-telegram — фолбэк-лендинг и точка автобутстрапа из TG WebView.
// /legal/* — юр-документы (читаются и из бота, и анонимно).
function isAnonymousAllowed(pathname: string): boolean {
  if (pathname.startsWith("/legal/") || /^\/(ru|uz)\/legal(\/|$)/.test(pathname)) return true;
  return false;
}

// Маршруты, которым НЕ нужен CSRF-чек (внешний контракт):
//  - /api/health: read-only GET (но если PATCH/PUT придёт — отвергнем как метод).
//  - /api/telegram/webhook: TG-сервер шлёт без Origin, защита через secret-token.
//  - /api/cron/*: внешний cron шлёт без Origin, защита через X-Cron-Secret.
function isCsrfExempt(pathname: string): boolean {
  return (
    pathname === "/api/health" ||
    pathname === "/api/telegram/webhook" ||
    pathname.startsWith("/api/cron/")
  );
}

// V2 Sprint 7+22: пути доступные анонимно для /api/* (не требуют bx_session).
// Используется для раннего отказа 401 при /api/* мутациях без сессии.
function isPublicApi(pathname: string): boolean {
  return (
    pathname.startsWith("/api/auth/bootstrap") ||
    pathname.startsWith("/api/health") ||
    pathname.startsWith("/api/cron/") ||
    pathname.startsWith("/api/telegram/webhook") ||
    pathname.startsWith("/api/admin/login") ||
    pathname.startsWith("/api/admin/logout") ||
    pathname.startsWith("/api/storage/o/") ||
    // OBS-4: секрет-защищённые ops-метрики (внешний монитор без bx_session).
    pathname === "/api/metrics"
  );
}

const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const SESSION_COOKIE = "bx_session";

export default function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const method = req.method.toUpperCase();

  // 0) SEC-3a: глобальный rate-limit + body-size cap — до любой другой работы.
  //    In-memory валиден: один Railway-инстанс, `next start` = один процесс.
  if (pathname.startsWith("/api/") && MUTATION_METHODS.has(method)) {
    const len = Number(req.headers.get("content-length") ?? 0);
    if (Number.isFinite(len) && len > MAX_BODY_BYTES) {
      return NextResponse.json({ ok: false, error: "payload_too_large" }, { status: 413 });
    }
  }
  const rate = checkRateLimit({
    pathname,
    ip: trustedIp(req),
    sessionValue: req.cookies.get(SESSION_COOKIE)?.value ?? null,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { ok: false, error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } },
    );
  }

  // 1) CSRF-гард на /api/* и /admin/* для мутирующих методов.
  //    F-010: bx_session под TG WebView требует SameSite=None+Secure, поэтому
  //    единственный надёжный барьер кросс-сайт POST'ов — проверка Origin.
  if (
    (pathname.startsWith("/api/") || pathname.startsWith("/admin")) &&
    MUTATION_METHODS.has(method) &&
    !isCsrfExempt(pathname)
  ) {
    if (!isAllowedOrigin(req)) {
      return NextResponse.json({ ok: false, error: "cross_origin" }, { status: 403 });
    }
  }

  // 2) /api/* и /admin/* без intl-роутинга/auth-гейта (выше уже отфильтровали CSRF).
  //    V2 Sprint 22 merge: x-request-id header для tracing (Web Crypto API).
  if (pathname.startsWith("/api/") || pathname.startsWith("/admin")) {
    // /api/admin/* использует admin_session — пропускаем без сессионной проверки.
    if (pathname.startsWith("/api/admin/")) {
      const res = NextResponse.next();
      res.headers.set("x-request-id", crypto.randomUUID());
      return res;
    }
    // /api/* protected — нужен bx_session cookie (раннее 401 до route handler).
    if (pathname.startsWith("/api/") && !isPublicApi(pathname)) {
      const cookie = req.cookies.get(SESSION_COOKIE);
      if (!cookie) {
        return new NextResponse(
          JSON.stringify({ ok: false, error: "no_session", request_id: crypto.randomUUID() }),
          {
            status: 401,
            headers: { "content-type": "application/json" },
          },
        );
      }
    }
    const res = NextResponse.next();
    res.headers.set("x-request-id", crypto.randomUUID());
    return res;
  }

  // 3) /open-in-telegram — вне [locale]; intl-middleware иначе делает 307.
  if (pathname === "/open-in-telegram" || pathname.startsWith("/open-in-telegram/")) {
    return NextResponse.next();
  }

  // 4) /legal/* — анонимно-разрешённые, проходят через next-intl.
  if (isAnonymousAllowed(pathname)) {
    return intl(req);
  }

  // 5) Нет сессии → отдаём фолбэк-лендинг (rewrite сохраняет ?token=... из bot-deeplink).
  const session = req.cookies.get("bx_session");
  if (!session) {
    const url = req.nextUrl.clone();
    url.pathname = "/open-in-telegram";
    url.search = req.nextUrl.search;
    return NextResponse.rewrite(url);
  }

  return intl(req);
}

export const config = {
  // Включаем api/admin (для CSRF-чека), исключаем только _next/_vercel и статические файлы.
  matcher: ["/((?!_next|_vercel|.*\\..*).*)"],
};
