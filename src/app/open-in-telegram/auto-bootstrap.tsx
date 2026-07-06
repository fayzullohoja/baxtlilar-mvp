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

  // Нужна регистрация в боте → сообщение поверх фолбэка (кнопка на бота ниже).
  if (diag.kind === "register_required") {
    return (
      <TopNote
        ru="Сначала пройдите регистрацию в боте."
        uz="Avval botda roʻyxatdan oʻting."
      />
    );
  }

  // Bootstrap failure: чаще всего token single-use уже claimed или TTL 10 мин
  // истёк. Понятная инструкция — вернуться в бот и /start.
  if (diag.kind === "bootstrap_error") {
    const expiredToken =
      diag.error === "bad_start_param" || diag.error === "missing_start_param";
    return (
      <TopNote
        ru={
          expiredToken
            ? "Ссылка устарела. Вернитесь в бот и отправьте /start заново."
            : "Не удалось войти. Вернитесь в бот и попробуйте снова."
        }
        uz={
          expiredToken
            ? "Havola muddati oʻtdi. Botga qaytib /start yuboring."
            : "Kirish amalga oshmadi. Botga qaytib qayta urinib koʻring."
        }
      />
    );
  }

  // fetch_error (сеть отвалилась).
  if (diag.kind === "fetch_error") {
    return <TopNote ru="Нет связи. Проверьте интернет." uz="Aloqa yoʻq. Internetni tekshiring." />;
  }

  // initData так и не появился (обычный браузер) — рендерим null, показывается
  // серверный фолбэк-лендинг с кнопкой на бота.
  if (diag.kind === "no_initdata_timeout") return null;

  // Loading — сдержанный editorial-лоадер поверх фолбэка (serif-знак + пульсирующий
  // аметистовый штрих). Респектит prefers-reduced-motion.
  return (
    <div
      className="absolute inset-0 z-50 flex flex-col items-center justify-center"
      style={{ background: "var(--color-v2-paper)" }}
    >
      <div
        style={{
          fontFamily: "var(--font-v2-display)",
          fontSize: 30,
          letterSpacing: "-0.02em",
          color: "var(--color-v2-ink-100)",
        }}
      >
        Baxtlilar
      </div>
      <div
        className="motion-safe:animate-pulse"
        style={{
          width: 40,
          height: 2,
          marginTop: 16,
          background: "var(--color-v2-accent)",
        }}
      />
      <p
        className="uppercase"
        style={{
          marginTop: 16,
          fontFamily: "var(--font-v2-mono)",
          fontSize: 11,
          letterSpacing: "0.18em",
          color: "var(--color-v2-ink-400)",
        }}
      >
        Загрузка · Yuklanmoqda
      </p>
    </div>
  );
}

// Тонкая плашка-уведомление поверх лендинга (V2: бумага/инк, без резких цветов).
function TopNote({ ru, uz }: { ru: string; uz: string }) {
  return (
    <div className="absolute inset-x-0 top-0 z-50 flex justify-center px-5 pt-5">
      <div
        style={{
          maxWidth: 400,
          width: "100%",
          background: "var(--color-v2-paper-2)",
          border: "1px solid var(--color-v2-border)",
          borderRadius: 12,
          padding: "12px 16px",
        }}
      >
        <p
          style={{
            margin: 0,
            fontFamily: "var(--font-v2-body)",
            fontSize: 14,
            fontWeight: 500,
            lineHeight: 1.4,
            color: "var(--color-v2-ink-200)",
          }}
        >
          {ru}
        </p>
        <p
          style={{
            margin: "3px 0 0",
            fontSize: 13,
            lineHeight: 1.4,
            color: "var(--color-v2-ink-400)",
          }}
        >
          {uz}
        </p>
      </div>
    </div>
  );
}
