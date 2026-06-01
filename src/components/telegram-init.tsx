"use client";

import { useEffect, useState } from "react";

type TgWebApp = {
  initData: string;
  ready: () => void;
  expand: () => void;
  colorScheme?: string;
};

declare global {
  interface Window {
    Telegram?: { WebApp?: TgWebApp };
  }
}

/**
 * Запускается при открытии Mini App внутри Telegram:
 * читает window.Telegram.WebApp.initData и вызывает /api/auth/bootstrap
 * (HMAC-валидация + upsert пользователя + сессия). Невидим в UI.
 * Вне Telegram (обычный браузер) ничего не делает, кроме dev-режима с DEV_BYPASS_TG.
 */
export function TelegramInit() {
  const [, setStatus] = useState<"idle" | "ok" | "skip" | "error">("idle");

  useEffect(() => {
    let cancelled = false;

    async function run(initData: string) {
      try {
        const res = await fetch("/api/auth/bootstrap", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ initData }),
        });
        if (!cancelled) setStatus(res.ok ? "ok" : "error");
      } catch {
        if (!cancelled) setStatus("error");
      }
    }

    // Telegram-скрипт может загрузиться чуть позже монтирования — ждём WebApp до ~3с.
    let tries = 0;
    const timer = setInterval(() => {
      tries += 1;
      const tg = window.Telegram?.WebApp;
      if (tg) {
        clearInterval(timer);
        tg.ready?.();
        tg.expand?.();
        const initData = tg.initData ?? "";
        if (initData) void run(initData);
        else setStatus("skip"); // обычный браузер вне Telegram
      } else if (tries >= 15) {
        clearInterval(timer);
        setStatus("skip");
      }
    }, 200);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  return null;
}
