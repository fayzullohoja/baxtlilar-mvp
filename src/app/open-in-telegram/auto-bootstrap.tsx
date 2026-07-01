"use client";

import { useEffect, useState } from "react";
import "@/lib/telegram/web-app-types";

// Внутри TG WebView эта компонента: читает initData, отправляет на bootstrap,
// сервер ставит cookie и редиректит. Если initData нет (обычный браузер) — НЕ
// делает ничего, server-side фолбэк показывает кнопку deep-link на бота.
// Если bootstrap вернул 403 register_required — пользователь не зарегистрирован
// у бота, показываем ту же кнопку.
type Diag =
  | { kind: "mounting" }
  | { kind: "polling"; tries: number; tgAvailable: boolean; initDataLen: number }
  | { kind: "fetching"; initDataLen: number; startParamLen: number }
  | { kind: "no_initdata_timeout" }
  | { kind: "fetch_error"; msg: string }
  | { kind: "bootstrap_error"; status: number; error: string }
  | { kind: "register_required" }
  | { kind: "ok" };

export function AutoBootstrap() {
  const [diag, setDiag] = useState<Diag>({ kind: "mounting" });

  useEffect(() => {
    let cancelled = false;
    const ac = new AbortController();

    let tries = 0;
    const timer = setInterval(() => {
      if (cancelled) return;
      tries += 1;
      const tg = window.Telegram?.WebApp;
      const initDataLen = tg?.initData?.length ?? 0;
      setDiag({ kind: "polling", tries, tgAvailable: !!tg, initDataLen });

      if (tg?.initData) {
        clearInterval(timer);
        try {
          tg.ready?.();
        } catch {
          /* не критично */
        }
        const urlToken = new URLSearchParams(window.location.search).get("token");
        const startParam = urlToken ?? tg.initDataUnsafe?.start_param ?? null;
        setDiag({
          kind: "fetching",
          initDataLen,
          startParamLen: startParam?.length ?? 0,
        });

        fetch("/api/auth/bootstrap", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ initData: tg.initData, start_param: startParam }),
          signal: ac.signal,
          credentials: "include",
        })
          .then(async (res) => {
            if (res.ok) {
              setDiag({ kind: "ok" });
              window.location.replace("/");
              return;
            }
            const body = (await res.json().catch(() => ({}))) as { error?: string };
            if (res.status === 403 && body.error === "register_required") {
              setDiag({ kind: "register_required" });
            } else {
              setDiag({
                kind: "bootstrap_error",
                status: res.status,
                error: body.error ?? "unknown",
              });
            }
          })
          .catch((e: unknown) =>
            setDiag({
              kind: "fetch_error",
              msg: e instanceof Error ? e.message : String(e),
            }),
          );
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

  // Пока идёт авто-вход внутри Telegram (initData читается / bootstrap в полёте /
  // успех перед редиректом) — показываем чистый брендовый лоадер ПОВЕРХ фолбэка.
  // Так юзер не видит ни технических диагностик, ни мигающей карточки «открой в
  // Telegram» (он уже в Telegram).
  const working =
    diag.kind === "mounting" ||
    diag.kind === "polling" ||
    diag.kind === "fetching" ||
    diag.kind === "ok";

  // Нужна регистрация в боте → понятное сообщение поверх фолбэка (у карточки
  // ниже уже есть кнопка-deep-link на бота).
  if (diag.kind === "register_required") {
    return (
      <div className="absolute inset-x-0 top-0 z-50 px-5 pt-6 text-center">
        <p className="text-sm text-baxt-navy">Сначала пройдите регистрацию в боте.</p>
        <p className="text-sm text-baxt-muted">Avval botda roʻyxatdan oʻting.</p>
        <DiagBanner diag={diag} />
      </div>
    );
  }

  // 2026-07-01 (Bug #A1): bootstrap_error чаще всего = bad_start_param
  // (token single-use уже claimed OR TTL 10 мин истёк). Юзер видел статичный
  // фолбэк «Откройте приложение через Telegram» без объяснения — думал что
  // сайт сломан. Теперь показываем понятную инструкцию поверх фолбэка:
  // вернись в бот и отправь /start заново. DiagBanner остаётся для дев-диагностики.
  if (diag.kind === "bootstrap_error") {
    const expiredToken =
      diag.error === "bad_start_param" || diag.error === "missing_start_param";
    return (
      <>
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
        <DiagBanner diag={diag} />
      </>
    );
  }

  // fetch_error (сеть отвалилась) — короткое сообщение поверх фолбэка.
  if (diag.kind === "fetch_error") {
    return (
      <>
        <div className="absolute inset-x-0 top-0 z-50 px-5 pt-6 text-center">
          <p className="text-sm font-medium text-baxt-navy">Нет связи. Проверьте интернет.</p>
          <p className="mt-1 text-sm text-baxt-muted">Aloqa yoʻq. Internetni tekshiring.</p>
        </div>
        <DiagBanner diag={diag} />
      </>
    );
  }

  // initData так и не появился (обычный браузер) — серверный фолбэк-лендинг
  // остаётся визуально; DiagBanner помогает диагностике на Android WebView
  // (release build, remote debug выключен) без повторного деплоя.
  if (!working) {
    return <DiagBanner diag={diag} />;
  }

  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-baxt-bg">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-baxt-coral text-2xl font-bold text-white shadow-[0_8px_24px_-8px_rgba(226,82,107,0.5)] motion-safe:animate-pulse">
        B
      </div>
      <p className="text-sm text-baxt-muted">Загрузка · Yuklanmoqda</p>
      <DiagBanner diag={diag} />
    </div>
  );
}

function DiagBanner({ diag }: { diag: Diag }) {
  const line = formatDiag(diag);
  return (
    <div className="fixed inset-x-0 bottom-0 z-[100] bg-baxt-navy/90 px-3 py-2 text-[11px] font-mono text-white break-all">
      diag: {line}
    </div>
  );
}

function formatDiag(d: Diag): string {
  switch (d.kind) {
    case "mounting":
      return "mounting";
    case "polling":
      return `polling tries=${d.tries} tg=${d.tgAvailable} initDataLen=${d.initDataLen}`;
    case "fetching":
      return `fetching initDataLen=${d.initDataLen} startParamLen=${d.startParamLen}`;
    case "no_initdata_timeout":
      return "no_initdata_timeout (15 polls, initData never arrived)";
    case "fetch_error":
      return `fetch_error msg=${d.msg}`;
    case "bootstrap_error":
      return `bootstrap_error status=${d.status} error=${d.error}`;
    case "register_required":
      return "register_required (user not in DB or on bot_* step)";
    case "ok":
      return "ok (redirecting)";
  }
}
