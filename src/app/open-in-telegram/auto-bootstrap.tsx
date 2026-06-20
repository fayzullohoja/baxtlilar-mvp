"use client";

import { useEffect, useState } from "react";
import "@/lib/telegram/web-app-types";

// Внутри TG WebView эта компонента: читает initData, отправляет на bootstrap,
// сервер ставит cookie и редиректит. Если initData нет (обычный браузер) — НЕ
// делает ничего, server-side фолбэк показывает кнопку deep-link на бота.
// Если bootstrap вернул 403 register_required — пользователь не зарегистрирован
// у бота, показываем ту же кнопку.
export function AutoBootstrap() {
  const [error, setError] = useState<"register_required" | "transient" | null>(null);

  useEffect(() => {
    let cancelled = false;
    const ac = new AbortController();

    // Telegram Desktop WebView инициализирует window.Telegram.WebApp АСИНХРОННО —
    // прямой read `tg.initData` на mount часто пуст. Поллим 200мс × 15 = 3с,
    // как и TelegramInit.tsx.
    let tries = 0;
    const timer = setInterval(() => {
      if (cancelled) return;
      tries += 1;
      const tg = window.Telegram?.WebApp;
      if (tg?.initData) {
        clearInterval(timer);
        try {
          tg.ready?.();
        } catch {
          /* не критично */
        }

        // start_param берём из двух мест:
        //  1) startapp= (TG-deeplink, t.me/<bot>/<short_name>?startapp=...) — initDataUnsafe.start_param
        //  2) ?token= в URL (web_app-кнопка без short_name) — location.search
        // Приоритет — explicit URL-параметр (его положили мы сами).
        const urlToken = new URLSearchParams(window.location.search).get("token");
        const startParam = urlToken ?? tg.initDataUnsafe?.start_param ?? null;
        fetch("/api/auth/bootstrap", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ initData: tg.initData, start_param: startParam }),
          signal: ac.signal,
          credentials: "include",
        })
          .then(async (res) => {
            if (res.ok) {
              window.location.replace("/");
              return;
            }
            const body = (await res.json().catch(() => ({}))) as { error?: string };
            if (res.status === 403 && body.error === "register_required") {
              setError("register_required");
            } else {
              setError("transient");
            }
          })
          .catch(() => setError("transient"));
      } else if (tries >= 15) {
        clearInterval(timer);
      }
    }, 200);

    return () => {
      cancelled = true;
      clearInterval(timer);
      ac.abort();
    };
  }, []);

  if (!error) return null;

  return (
    <div className="absolute top-0 left-0 right-0 bg-baxt-coral/10 text-baxt-coral text-center text-sm py-2 px-4">
      {error === "register_required"
        ? "Сначала пройдите регистрацию в боте · Avval botda roʻyxatdan oʻting"
        : "Не удалось войти. Попробуйте ещё раз."}
    </div>
  );
}
