import createMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";
import { routing } from "@/i18n/routing";
import { isAllowedOrigin } from "@/lib/http/origin-check";

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
function isCsrfExempt(pathname: string): boolean {
  return pathname === "/api/health" || pathname === "/api/telegram/webhook";
}

const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export default function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const method = req.method.toUpperCase();

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

  // 2) /api/* и /admin/* без intl-роутинга/auth-гейта (выше уже отфильтровали CSRF)
  if (pathname.startsWith("/api/") || pathname.startsWith("/admin")) {
    return NextResponse.next();
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
