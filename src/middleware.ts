import { NextResponse, type NextRequest } from "next/server";

/**
 * V2 Phase A · Sprint 7 — Edge middleware (4-й эшелон защиты по Blueprint §2.6).
 *
 * Что делает:
 *   1. Раннее 401 для /api/* без session cookie (быстрее чем дойти до handler).
 *   2. Skip-list для публичных роутов (auth/bootstrap, cron, telegram webhook,
 *      admin/login, health).
 *   3. X-Request-Id header для tracing (Web Crypto API, доступно в Edge).
 *
 * Что НЕ делает:
 *   - НЕ декодирует cookie payload (только проверяет наличие): hMAC-проверка
 *     стоит ресурсов и уже делается в getSessionUserId на route-стороне.
 *     Здесь cheap presence-check, чтобы 401 не доходил до DB lookup.
 *   - НЕ проверяет роли/permission: они зависят от lifecycle_state +
 *     verification_status, которые в Edge runtime недоступны (нет DB).
 *     Эти проверки делает withPermission wrapper (Sprint 5).
 *   - НЕ инвалидирует сессии при role change: текущая архитектура читает
 *     роль из DB на каждом запросе через getCurrentUser → fresh role.
 *     Stale UI инвалидируется на следующий открытии mini-app.
 *
 * Эшелоны защиты (Blueprint §2.8):
 *   1. ✅ Middleware           — этот файл (presence check)
 *   2. ✅ Route handler        — withPermission (Sprint 5)
 *   3. ✅ RPC SECURITY DEFINER — get_recommendations viewer-gate (Sprint 5)
 *   4. ✅ DB filter            — implicit в RPC where clauses
 */

const SESSION_COOKIE = "bx_session";

/**
 * Маршруты которые НЕ требуют сессии (доступны без cookie).
 * Префиксное совпадение (startsWith).
 */
const PUBLIC_API_PREFIXES: readonly string[] = [
  "/api/auth/bootstrap", // создаёт сессию
  "/api/health", // public health-check
  "/api/cron/", // own auth via X-Cron-Secret
  "/api/telegram/webhook", // own auth via X-Telegram-Bot-Api-Secret-Token
  "/api/admin/login", // создаёт admin сессию
  "/api/admin/logout", // очищает сессию (cookie сам решает)
  "/api/storage/o/", // signed URL — own auth
];

function isPublicApi(pathname: string): boolean {
  for (const prefix of PUBLIC_API_PREFIXES) {
    if (pathname.startsWith(prefix)) return true;
  }
  return false;
}

function newRequestId(): string {
  // Web Crypto API — доступен в Edge runtime. Альтернатива uuid модулю.
  return crypto.randomUUID();
}

export function middleware(req: NextRequest): NextResponse {
  const { pathname } = req.nextUrl;
  const requestId = newRequestId();

  // /api/* protected routes — нужна сессия (presence-check, HMAC уже в handler'е).
  if (pathname.startsWith("/api/") && !isPublicApi(pathname)) {
    // Админские эндпоинты используют свою сессию (admin_session), не bx_session.
    // Для них middleware пропускает (admin guard в самом handler'е).
    if (pathname.startsWith("/api/admin/")) {
      // Пропускаем — adminGuard сделает свою проверку.
      const res = NextResponse.next();
      res.headers.set("x-request-id", requestId);
      return res;
    }

    const cookie = req.cookies.get(SESSION_COOKIE);
    if (!cookie) {
      return new NextResponse(
        JSON.stringify({ ok: false, error: "no_session", request_id: requestId }),
        {
          status: 401,
          headers: {
            "content-type": "application/json",
            "x-request-id": requestId,
          },
        },
      );
    }
  }

  // Все остальные запросы — пропускаем с request-id header.
  const res = NextResponse.next();
  res.headers.set("x-request-id", requestId);
  return res;
}

/**
 * Matcher: применяем middleware только к /api/* и страницам где осмысленно
 * иметь request-id. Skip для статики (_next/static, _next/image, favicon).
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     *  - _next/static (static files)
     *  - _next/image (image optimization)
     *  - favicon.ico
     *  - public files (paths with extension)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.[a-zA-Z0-9]+$).*)",
  ],
};
