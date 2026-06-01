import createMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";

export default createMiddleware(routing);

export const config = {
  // Не запускать на api / admin / _next / статике
  matcher: ["/((?!api|admin|_next|_vercel|.*\\..*).*)"],
};
