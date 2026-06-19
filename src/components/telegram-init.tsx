"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { clientNextPath } from "@/lib/state-machine/client-paths";
import "@/lib/telegram/web-app-types";

/**
 * При открытии Mini App внутри Telegram: читает initData → /api/auth/bootstrap
 * (HMAC + upsert + сессия). При успехе, если пользователь уже не на welcome-шаге,
 * перебрасывает на его актуальный экран (resumable). Вне Telegram — ничего не делает.
 */
export function TelegramInit() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    let cancelled = false;

    async function bootstrap(initData: string) {
      try {
        const res = await fetch("/api/auth/bootstrap", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ initData }),
        });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as {
          ok: boolean;
          onboarding_step?: string;
          lifecycle_state?: string;
        };
        if (!data.ok) return;
        const target = clientNextPath(data.lifecycle_state ?? "onboarding", data.onboarding_step ?? "language");
        // Резюмируемость: редиректим только если попали на welcome, а шаг уже дальше.
        if (pathname === "/" && target !== "/" && !cancelled) router.replace(target);
      } catch {
        /* офлайн / ошибка — остаёмся на текущем экране */
      }
    }

    let tries = 0;
    const timer = setInterval(() => {
      tries += 1;
      const tg = window.Telegram?.WebApp;
      if (tg) {
        clearInterval(timer);
        tg.ready?.();
        tg.expand?.();
        const initData = tg.initData ?? "";
        if (initData) void bootstrap(initData);
      } else if (tries >= 15) {
        clearInterval(timer);
      }
    }, 200);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [pathname, router]);

  return null;
}
