"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button } from "./Button";
import { Headline, Lead } from "./Headline";

/**
 * V2 InterestModal — editorial-confirmation перед отправкой интереса.
 *
 * Целевой тон: это не лайк, это просьба познакомиться. Optional message —
 * настоятельно рекомендуем, но не обязываем (учредитель 2026-06-25:
 * «рекомендует, не навязывает»).
 *
 * После submit:
 *   - mutual=true → сразу в чат /chats/{chat_id}
 *   - sent=true   → success-вид «отправлено» внутри модала
 *   - blocked / already_sent / daily_limit / etc → ошибка
 *
 * Anti-contact фильтрация уже на бэке (см. /api/interest), здесь
 * её не дублируем — иначе UX будет «правило про правило».
 */

type Props = {
  candidateId: string;
  candidateFirstName: string;
  onClose: () => void;
};

type SubmitState =
  | { kind: "idle" }
  | { kind: "pending" }
  | { kind: "sent" }
  | { kind: "error"; code: string };

export function InterestModal({ candidateId, candidateFirstName, onClose }: Props) {
  const t = useTranslations("InterestModal");
  const router = useRouter();
  const errorCopy: Record<string, string> = {
    contact_blocked: t("err_contact_blocked"),
    already_sent: t("err_already_sent"),
    daily_limit: t("err_daily_limit"),
    declined: t("err_declined"),
    blocked: t("err_blocked"),
    unavailable: t("err_unavailable"),
    no_interest_permission: t("err_no_interest_permission"),
    failed: t("err_failed"),
  };
  const [message, setMessage] = useState("");
  const [state, setState] = useState<SubmitState>({ kind: "idle" });
  const [pending, startTransition] = useTransition();

  function submit() {
    if (pending || state.kind === "sent") return;
    setState({ kind: "pending" });
    startTransition(async () => {
      const res = await fetch("/api/interest", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ receiver_id: candidateId, message: message.trim() || undefined }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok: boolean;
        mutual?: boolean;
        next?: string;
        error?: string;
      };
      if (data.ok) {
        if (data.mutual && data.next) {
          router.replace(data.next);
        } else {
          setState({ kind: "sent" });
        }
        return;
      }
      setState({ kind: "error", code: data.error ?? "failed" });
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(42, 26, 46, 0.55)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        zIndex: 50,
        fontFamily: "var(--font-v2-body)",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !pending) onClose();
      }}
    >
      <div
        className="v2-rise"
        style={{
          background: "#ffffff",
          width: "100%",
          maxWidth: "var(--v2-max-width)",
          borderTopLeftRadius: "var(--v2-radius-card)",
          borderTopRightRadius: "var(--v2-radius-card)",
          boxShadow: "var(--v2-shadow-card-lg)",
          padding: "32px 24px 24px",
          maxHeight: "92vh",
          overflowY: "auto",
        }}
      >
        {state.kind === "sent" ? (
          <>
            <Headline size="md" as="h2">
              {t("sentTitle")}
            </Headline>
            <Lead>{t("sentDescription", { name: candidateFirstName })}</Lead>
            <div style={{ marginTop: "24px" }}>
              <Button variant="primary" onClick={onClose}>
                {t("confirm")}
              </Button>
            </div>
          </>
        ) : (
          <>
            <div
              style={{
                fontSize: "12px",
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: "0.14em",
                color: "var(--color-v2-accent)",
                marginBottom: "12px",
              }}
            >
              {t("eyebrow")}
            </div>
            <Headline size="md" as="h2">
              {t("title")}
            </Headline>
            <Lead>{t("description", { name: candidateFirstName })}</Lead>

            <div style={{ marginTop: "24px" }}>
              <label
                htmlFor="interest-msg"
                style={{
                  display: "block",
                  fontSize: "13px",
                  fontWeight: 700,
                  color: "var(--color-v2-ink-300)",
                  marginBottom: "8px",
                }}
              >
                {t("messageLabel")}
              </label>
              <textarea
                id="interest-msg"
                value={message}
                onChange={(e) => setMessage(e.target.value.slice(0, 300))}
                placeholder={t("messagePlaceholder")}
                rows={4}
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "13px 15px",
                  fontFamily: "var(--font-v2-body)",
                  fontSize: "15px",
                  lineHeight: "1.5",
                  color: "var(--color-v2-ink-100)",
                  background: "#ffffff",
                  border: "1.5px solid var(--color-v2-ink-500)",
                  borderRadius: "var(--v2-radius-md)",
                  resize: "vertical",
                  outline: "none",
                }}
              />
              <div
                style={{
                  textAlign: "right",
                  fontSize: "11px",
                  color: "var(--color-v2-ink-400)",
                  marginTop: "6px",
                }}
              >
                {message.length} / 300
              </div>
            </div>

            {state.kind === "error" ? (
              <div
                style={{
                  marginTop: "12px",
                  padding: "12px 14px",
                  background: "#FBE7E4",
                  borderLeft: "3px solid var(--color-v2-danger)",
                  borderRadius: "12px",
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "#9A4B46",
                  lineHeight: "1.5",
                }}
              >
                {errorCopy[state.code] ?? errorCopy.failed}
              </div>
            ) : null}

            <div style={{ marginTop: "24px", display: "flex", flexDirection: "column", gap: "10px" }}>
              <Button
                variant="primary"
                onClick={submit}
                disabled={pending}
              >
                {pending ? t("sending") : t("send")}
              </Button>
              <Button variant="ghost" onClick={onClose} disabled={pending}>
                {t("cancel")}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
