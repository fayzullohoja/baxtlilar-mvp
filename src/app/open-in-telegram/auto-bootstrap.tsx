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

  // F-final-5b debug banner — поможет диагностировать прод-bootstrap.
  // Скрыть после выяснения root cause.
  const msg = (() => {
    switch (diag.kind) {
      case "mounting":
        return "[diag] mounting";
      case "polling":
        return `[diag] polling try ${diag.tries}/15 tg=${diag.tgAvailable ? "yes" : "no"} initDataLen=${diag.initDataLen}`;
      case "fetching":
        return `[diag] fetching initDataLen=${diag.initDataLen} startParamLen=${diag.startParamLen}`;
      case "no_initdata_timeout":
        return "[diag] no initData after 3s — не в TG WebView или TG не populated initData";
      case "fetch_error":
        return `[diag] fetch error: ${diag.msg}`;
      case "bootstrap_error":
        return `[diag] bootstrap ${diag.status}: ${diag.error}`;
      case "register_required":
        return "Сначала пройдите регистрацию в боте · Avval botda roʻyxatdan oʻting";
      case "ok":
        return "[diag] ok — редирект";
    }
  })();

  return (
    <div
      className="absolute top-0 left-0 right-0 bg-baxt-coral/10 text-baxt-coral text-center text-xs py-2 px-4 z-50"
      style={{ wordBreak: "break-word" }}
    >
      {msg}
    </div>
  );
}
