"use client";

import { useState, useTransition } from "react";
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

const ERROR_COPY: Record<string, string> = {
  contact_blocked: "В сообщении нашёлся контакт (телефон, ник, ссылка). Это здесь не работает — удали и попробуй снова.",
  already_sent: "Ты уже отправлял интерес этому человеку.",
  daily_limit: "На сегодня лимит интересов исчерпан. Возвращайся завтра.",
  declined: "Этот человек недоступен.",
  blocked: "Этот человек недоступен.",
  unavailable: "Анкета больше не доступна.",
  no_interest_permission: "Чтобы отправить интерес, нужна верификация.",
  failed: "Что-то пошло не так. Попробуй ещё раз.",
};

export function InterestModal({ candidateId, candidateFirstName, onClose }: Props) {
  const router = useRouter();
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
        background: "rgba(10, 9, 8, 0.6)",
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
        style={{
          background: "var(--color-v2-paper)",
          width: "100%",
          maxWidth: "var(--v2-max-width)",
          borderTopLeftRadius: "var(--v2-radius-lg)",
          borderTopRightRadius: "var(--v2-radius-lg)",
          padding: "32px 24px 24px",
          maxHeight: "92vh",
          overflowY: "auto",
        }}
      >
        {state.kind === "sent" ? (
          <>
            <Headline size="md" as="h2">
              Интерес отправлен.
            </Headline>
            <Lead>
              Если {candidateFirstName} ответит интересом — придёт уведомление
              в&nbsp;Telegram и&nbsp;откроется чат. Если нет — через&nbsp;72&nbsp;часа
              заявка автоматически закроется, и&nbsp;человек не&nbsp;увидит её&nbsp;в&nbsp;своих
              запросах.
            </Lead>
            <div style={{ marginTop: "24px" }}>
              <Button variant="primary" onClick={onClose}>
                Понятно
              </Button>
            </div>
          </>
        ) : (
          <>
            <div
              style={{
                fontSize: "11px",
                textTransform: "uppercase",
                letterSpacing: "0.12em",
                color: "var(--color-v2-ink-400)",
                marginBottom: "12px",
              }}
            >
              Отправить интерес
            </div>
            <Headline size="md" as="h2">
              Это не&nbsp;лайк. Это просьба познакомиться.
            </Headline>
            <Lead>
              {candidateFirstName} увидит твой интерес в&nbsp;разделе «Запросы».
              Добавь короткое сообщение — что зацепило, на&nbsp;что хочется
              отозваться. Можно без сообщения, но шансов на ответ меньше.
            </Lead>

            <div style={{ marginTop: "24px" }}>
              <label
                htmlFor="interest-msg"
                style={{
                  display: "block",
                  fontSize: "13px",
                  color: "var(--color-v2-ink-300)",
                  marginBottom: "8px",
                }}
              >
                Сообщение (по желанию, до 300 символов)
              </label>
              <textarea
                id="interest-msg"
                value={message}
                onChange={(e) => setMessage(e.target.value.slice(0, 300))}
                placeholder="Что в анкете отозвалось?"
                rows={4}
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  fontFamily: "var(--font-v2-body)",
                  fontSize: "15px",
                  lineHeight: "1.5",
                  color: "var(--color-v2-ink-100)",
                  background: "transparent",
                  border: "1px solid var(--color-v2-ink-500)",
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
                  background: "rgba(180, 50, 50, 0.08)",
                  border: "1px solid rgba(180, 50, 50, 0.3)",
                  borderRadius: "var(--v2-radius-md)",
                  fontSize: "13px",
                  color: "var(--color-v2-ink-200)",
                  lineHeight: "1.5",
                }}
              >
                {ERROR_COPY[state.code] ?? ERROR_COPY.failed}
              </div>
            ) : null}

            <div style={{ marginTop: "24px", display: "flex", flexDirection: "column", gap: "8px" }}>
              <Button
                variant="primary"
                onClick={submit}
                disabled={pending}
              >
                {pending ? "Отправляю…" : "Отправить"}
              </Button>
              <Button variant="ghost" onClick={onClose} disabled={pending}>
                Отмена
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
