"use client";

import { useEffect } from "react";
import { useRouter } from "@/i18n/navigation";

/**
 * Тихо обновляет серверный контент страницы (router.refresh) по таймеру и при
 * возврате фокуса — для «живых» списков (диалоги, бейджи непрочитанных) без
 * отдельного API. Пауза, когда вкладка скрыта.
 */
export function AutoRefresh({ interval = 8000 }: { interval?: number }) {
  const router = useRouter();
  useEffect(() => {
    const iv = setInterval(() => {
      if (!document.hidden) router.refresh();
    }, interval);
    const onWake = () => {
      if (!document.hidden) router.refresh();
    };
    document.addEventListener("visibilitychange", onWake);
    window.addEventListener("focus", onWake);
    return () => {
      clearInterval(iv);
      document.removeEventListener("visibilitychange", onWake);
      window.removeEventListener("focus", onWake);
    };
  }, [router, interval]);
  return null;
}
