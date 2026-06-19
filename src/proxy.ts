import createMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";
import { routing } from "@/i18n/routing";

const intl = createMiddleware(routing);

// Пути, доступные анонимно (без bx_session cookie).
// /open-in-telegram — фолбэк-лендинг и точка автобутстрапа из TG WebView.
// /legal/* — юр-документы (читаются и из бота, и анонимно).
function isAnonymousAllowed(pathname: string): boolean {
  if (pathname === "/open-in-telegram" || pathname.startsWith("/open-in-telegram/")) return true;
  if (pathname.startsWith("/legal/") || /^\/(ru|uz)\/legal(\/|$)/.test(pathname)) return true;
  return false;
}

export default function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // /open-in-telegram живёт ВНЕ [locale]; intl-middleware иначе делает 307 →
  // /ru/open-in-telegram. Пропускаем сразу.
  if (pathname === "/open-in-telegram" || pathname.startsWith("/open-in-telegram/")) {
    return NextResponse.next();
  }

  // /legal/* — anonymous-allowed и под locale. Проходят через next-intl.
  if (isAnonymousAllowed(pathname)) {
    return intl(req);
  }

  // нет сессии → отдаём фолбэк-лендинг (rewrite — без 307, тот же URL)
  const session = req.cookies.get("bx_session");
  if (!session) {
    const url = req.nextUrl.clone();
    url.pathname = "/open-in-telegram";
    url.search = req.nextUrl.search; // сохраняем ?token=... из bot-deeplink
    return NextResponse.rewrite(url);
  }

  return intl(req);
}

export const config = {
  // Не запускать на api / admin / _next / статике
  matcher: ["/((?!api|admin|_next|_vercel|.*\\..*).*)"],
};
