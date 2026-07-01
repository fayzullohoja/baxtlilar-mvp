"use client";

import { useEffect, useState } from "react";
import "@/lib/telegram/web-app-types";

// Внутри TG WebView эта компонента: читает initData, отправляет на bootstrap,
// сервер ставит cookie и редиректит. Если initData нет (обычный браузер) — НЕ
// делает ничего, server-side фолбэк показывает кнопку deep-link на бота.
// Если bootstrap вернул 403 register_required — пользователь не зарегистрирован
// у бота, показываем ту же кнопку.
type Diag =
  | { kind: "loading" }
  | { kind: "bootstrap_error"; error: string }
  | { kind: "fetch_error" }
  | { kind: "register_required" }
  | { kind: "no_initdata_timeout" };

// TG Android WebView коммитит Set-Cookie асинхронно (см. incident 2026-07-01).
// Синхронный window.location.replace("/") сразу после res.ok приводит к тому,
// что follow-up GET / уходит БЕЗ bx_session cookie → сервер редиректит обратно
// на /open-in-telegram → второй POST с тем же token → 401 token_replay.
// 400мс достаточно для commit'а на всех проверенных сборках Telegram (12.8+).
const REDIRECT_DELAY_MS = 400;

export function AutoBootstrap() {
  const [diag, setDiag] = useState<Diag>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    const ac = new AbortController();

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
              setTimeout(() => window.location.replace("/"), REDIRECT_DELAY_MS);
              return;
            }
            const body = (await res.json().catch(() => ({}))) as { error?: string };
            if (res.status === 403 && body.error === "register_required") {
              setDiag({ kind: "register_required" });
            } else {
              setDiag({ kind: "bootstrap_error", error: body.error ?? "unknown" });
            }
          })
          .catch(() => setDiag({ kind: "fetch_error" }));
      } else if (tries >= 15) {
        clearInterval(timer);
        setDiag({ kind: "no_initdata_timeout" });
      }
    }, 200);

    return () => {
      cancelled = true;
      clearInterval(timer);
      ac.abort();
    };
  }, []);

  // Нужна регистрация в боте → понятное сообщение поверх фолбэка (у карточки
  // ниже уже есть кнопка-deep-link на бота).
  if (diag.kind === "register_required") {
    return (
      <div className="absolute inset-x-0 top-0 z-50 px-5 pt-6 text-center">
        <p className="text-sm text-baxt-navy">Сначала пройдите регистрацию в боте.</p>
        <p className="text-sm text-baxt-muted">Avval botda roʻyxatdan oʻting.</p>
      </div>
    );
  }

  // Bootstrap failure: чаще всего bad_start_param — token single-use уже claimed
  // OR TTL 10 мин истёк. Даём понятную инструкцию — вернуться в бот и /start.
  if (diag.kind === "bootstrap_error") {
    const expiredToken =
      diag.error === "bad_start_param" || diag.error === "missing_start_param";
    return (
      <div className="absolute inset-x-0 top-0 z-50 px-5 pt-6 text-center">
        <p className="text-sm font-medium text-baxt-navy">
          {expiredToken
            ? "Ссылка устарела. Вернитесь в бот и отправьте /start заново."
            : "Не удалось войти. Вернитесь в бот и попробуйте снова."}
        </p>
        <p className="mt-1 text-sm text-baxt-muted">
          {expiredToken
            ? "Havola muddati oʻtdi. Botga qaytib /start yuboring."
            : "Kirish amalga oshmadi. Botga qaytib qayta urinib koʻring."}
        </p>
      </div>
    );
  }

  // fetch_error (сеть отвалилась) — короткое сообщение поверх фолбэка.
  if (diag.kind === "fetch_error") {
    return (
      <div className="absolute inset-x-0 top-0 z-50 px-5 pt-6 text-center">
        <p className="text-sm font-medium text-baxt-navy">Нет связи. Проверьте интернет.</p>
        <p className="mt-1 text-sm text-baxt-muted">Aloqa yoʻq. Internetni tekshiring.</p>
      </div>
    );
  }

  // initData так и не появился (обычный браузер) — рендерим null, показывается
  // серверный фолбэк-лендинг с кнопкой на бота.
  if (diag.kind === "no_initdata_timeout") return null;

  // Loading — брендовый лоадер поверх фолбэка.
  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-baxt-bg">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-baxt-coral text-2xl font-bold text-white shadow-[0_8px_24px_-8px_rgba(226,82,107,0.5)] motion-safe:animate-pulse">
        B
      </div>
      <p className="text-sm text-baxt-muted">Загрузка · Yuklanmoqda</p>
    </div>
  );
}
