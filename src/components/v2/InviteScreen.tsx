"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "./Button";
import { Headline } from "./Headline";
import { InviteNotVerifiedCard } from "./InviteNotVerifiedCard";
import "@/lib/telegram/web-app-types";

/**
 * V2 InviteScreen (Task 9) - тело экрана «Пригласить» для approved-юзеров.
 *
 * Единственный консюмер GET /api/invite (Task 8) во всей мини-аппе: сам
 * запрашивает код + счётчик на маунте. Клиентский компонент, а не серверный
 * кусок страницы, - чтобы состояние сбоя могло предложить «Повторить» без
 * полной перезагрузки страницы (обычный router.refresh() в серверном
 * компоненте это тоже даёт, но здесь повтор - это просто повторный fetch
 * того же роута, без похода через Next.js навигацию).
 *
 * "not_verified" (403 от роута) сюда в норме не долетает - page.tsx уже знает
 * verification_status из requireActiveUser и монтирует этот компонент только
 * для approved. Ветка оставлена как защита от гонки (статус поменялся между
 * рендером страницы и этим fetch) - тем же InviteNotVerifiedCard, что и на
 * сервере, чтобы текст не мог разъехаться в двух местах.
 */

type ApiResponse =
  | { ok: true; code: string; invited: number }
  | { ok: false; error: string };

type Status = "loading" | "ok" | "not_verified" | "error";

const BOT_USERNAME = "baxtlilar_uz_bot";

export type CopyOutcome = "copied" | "failed";

/**
 * Вынесено из компонента отдельной функцией специально ради тестируемости:
 * у самого InviteScreen нет "use client"-инфраструктуры для рендер-тестов
 * (в проекте вообще нет ни одного .test.tsx, happy-dom - неиспользуемая
 * devDependency) - заводить её ради одной ветки было бы непропорционально.
 * Здесь же чистая функция без React - обычный .test.ts, без смены окружения
 * vitest.
 */
export async function copyToClipboard(text: string): Promise<CopyOutcome> {
  try {
    if (!navigator.clipboard) return "failed";
    await navigator.clipboard.writeText(text);
    return "copied";
  } catch {
    return "failed";
  }
}

export function V2InviteScreen() {
  const t = useTranslations("Invite");
  const [status, setStatus] = useState<Status>("loading");
  const [code, setCode] = useState("");
  const [invited, setInvited] = useState(0);
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);

  // Promise .then/.catch, а не async/await: react-hooks/set-state-in-effect
  // ругается на setState синхронно в теле эффекта, и трактует ЛЮБОЙ setState
  // внутри async-функции, вызванной из эффекта, как "синхронный" (даже после
  // await). .then()/.catch() - тот же приём, что уже используется в
  // auto-bootstrap.tsx (Task-независимый прецедент) - лежит в отдельном
  // колбэке, лимитация на него не распространяется.
  const load = useCallback(() => {
    fetch("/api/invite")
      .then((res) => res.json().catch(() => null) as Promise<ApiResponse | null>)
      .then((data) => {
        if (data?.ok) {
          setCode(data.code);
          setInvited(data.invited);
          setStatus("ok");
          return;
        }
        // not_verified - осознанное состояние роута (403), любой другой
        // error/сбой парсинга/сетевой обрыв - общий "error" с повтором.
        setStatus(data && !data.ok && data.error === "not_verified" ? "not_verified" : "error");
      })
      .catch(() => setStatus("error"));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function retry() {
    setStatus("loading");
    load();
  }

  const shareUrl = `https://t.me/${BOT_USERNAME}?start=${code}`;

  // На отказ (старый Android WebView без Clipboard API, нет разрешения) не
  // молчим: раньше был голый try/catch с пустым catch - человек жал кнопку,
  // ничего не менялось, и он решал, что кнопка сломана, хотя код всё это
  // время виден крупно на экране и его можно выделить руками. Теперь отказ
  // явно показывает t("copy_error") с текстом, что делать вручную. Сама
  // проверка успех/отказ вынесена в copyToClipboard (см. выше) - там же тест.
  async function copyLink() {
    const outcome = await copyToClipboard(shareUrl);
    if (outcome === "copied") {
      setCopyFailed(false);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } else {
      setCopied(false);
      setCopyFailed(true);
    }
  }

  function shareTelegram() {
    const url = `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(t("share_text"))}`;
    // Внутри Telegram WebView window.open обычно ничего не делает (попапы
    // блокируются) - openTelegramLink открывает t.me-ссылку нативно, не
    // разрывая мини-аппу. window.open остаётся фолбэком для обычного браузера
    // (например, при тестировании вне Telegram).
    const tg = window.Telegram?.WebApp;
    if (tg?.openTelegramLink) {
      tg.openTelegramLink(url);
    } else {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  }

  if (status === "loading") {
    return (
      <div
        style={{
          padding: "40px 0",
          textAlign: "center",
          color: "var(--color-v2-ink-400)",
          fontFamily: "var(--font-v2-body)",
          fontSize: "14px",
        }}
      >
        {t("loading")}
      </div>
    );
  }

  if (status === "not_verified") {
    return <InviteNotVerifiedCard title={t("not_verified_title")} body={t("not_verified")} />;
  }

  if (status === "error") {
    return (
      <div
        className="v2-rise"
        style={{
          background: "#fff",
          border: "1px solid var(--color-v2-border)",
          borderRadius: "var(--v2-radius-card)",
          boxShadow: "var(--v2-shadow-card)",
          padding: "28px 22px",
          fontFamily: "var(--font-v2-body)",
        }}
      >
        <Headline size="sm" as="h3">
          {t("error_title")}
        </Headline>
        <p
          style={{
            fontSize: "14px",
            lineHeight: "1.55",
            color: "var(--color-v2-ink-300)",
            margin: "10px 0 20px",
          }}
        >
          {t("error_body")}
        </p>
        <Button onClick={retry} variant="secondary">
          {t("retry")}
        </Button>
      </div>
    );
  }

  // status === "ok"
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div
        className="v2-rise"
        style={{
          background: "#fff",
          borderRadius: "var(--v2-radius-card)",
          boxShadow: "var(--v2-shadow-card)",
          padding: "28px 22px",
          textAlign: "center",
          fontFamily: "var(--font-v2-body)",
        }}
      >
        <div
          style={{
            fontSize: "12px",
            fontWeight: 800,
            textTransform: "uppercase",
            letterSpacing: "0.14em",
            color: "var(--color-v2-accent)",
            marginBottom: "16px",
          }}
        >
          {t("code_label")}
        </div>
        <div
          style={{
            fontFamily: "var(--font-v2-mono)",
            fontWeight: 700,
            fontSize: "40px",
            letterSpacing: "0.22em",
            // компенсация letter-spacing: без paddingLeft последний символ
            // визуально ближе к правому краю, чем первый - к левому
            paddingLeft: "0.22em",
            color: "var(--color-v2-ink-100)",
          }}
        >
          {code}
        </div>
      </div>

      <Button onClick={copyLink} variant="primary">
        {copied ? t("copied") : t("copy_link")}
      </Button>
      {copyFailed ? (
        <div
          style={{
            padding: "10px 14px",
            background: "#FBE7E4",
            borderLeft: "3px solid var(--color-v2-danger)",
            borderRadius: "12px",
            fontSize: "13px",
            fontWeight: 600,
            color: "#9A4B46",
            fontFamily: "var(--font-v2-body)",
          }}
        >
          {t("copy_error")}
        </div>
      ) : null}
      <Button onClick={shareTelegram} variant="trust">
        {t("share")}
      </Button>

      <div
        style={{
          textAlign: "center",
          fontSize: "13px",
          color: "var(--color-v2-ink-400)",
          fontFamily: "var(--font-v2-body)",
          marginTop: "4px",
        }}
      >
        {t("joined_count", { n: invited })}
      </div>
    </div>
  );
}
