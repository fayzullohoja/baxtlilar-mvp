"use client";

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "./Button";

/**
 * V2 ProfileSafetyActions — кнопки Report + Block на /v2/profile/[id].
 *
 * Стиль ghost — не первое действие, но всегда доступно. Confirm-modal
 * для block (необратимо рвёт интересы + чат становится недоступным).
 */

type Props = {
  targetId: string;
  targetFirstName: string;
};

export function ProfileSafetyActions({ targetId, targetFirstName }: Props) {
  const router = useRouter();
  const [reportOpen, setReportOpen] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState<"reported" | "blocked" | null>(null);

  function block() {
    if (pending) return;
    startTransition(async () => {
      const res = await fetch("/api/block", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ target_id: targetId, action: "block" }),
      });
      if (res.ok) {
        setDone("blocked");
        setBlockOpen(false);
        // Refresh main — заблокированный больше не в ленте + чат пропал.
        setTimeout(() => router.replace("/main"), 1500);
      }
    });
  }

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "32px" }}>
        <Button onClick={() => setReportOpen(true)} variant="ghost" disabled={pending || done !== null}>
          {done === "reported" ? "Жалоба отправлена" : "Пожаловаться"}
        </Button>
        <Button onClick={() => setBlockOpen(true)} variant="ghost" disabled={pending || done !== null}>
          {done === "blocked" ? "Заблокирован" : "Заблокировать"}
        </Button>
      </div>

      {reportOpen ? (
        <ReportModal
          targetId={targetId}
          targetFirstName={targetFirstName}
          onClose={() => setReportOpen(false)}
          onSent={() => {
            setDone("reported");
            setReportOpen(false);
          }}
        />
      ) : null}

      {blockOpen ? (
        <BlockConfirm
          firstName={targetFirstName}
          onClose={() => setBlockOpen(false)}
          onConfirm={block}
          pending={pending}
        />
      ) : null}
    </>
  );
}

// =============================================================================
// Report modal
// =============================================================================

const REASONS = [
  { code: "fake", label: "Подозреваю фейк / не настоящий" },
  { code: "offensive", label: "Оскорбления, грубость" },
  { code: "contacts", label: "Просит контакты вне приложения" },
  { code: "spam", label: "Реклама, спам" },
  { code: "inappropriate", label: "Контент не для знакомств" },
  { code: "other", label: "Другое" },
];

function ReportModal({
  targetId,
  targetFirstName,
  onClose,
  onSent,
}: {
  targetId: string;
  targetFirstName: string;
  onClose: () => void;
  onSent: () => void;
}) {
  const [reason, setReason] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function send() {
    if (!reason || pending) return;
    startTransition(async () => {
      const res = await fetch("/api/report", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          target_user_id: targetId,
          reason_code: reason,
          comment: comment.trim() || undefined,
        }),
      });
      if (res.ok) {
        onSent();
        return;
      }
      setErr("Не получилось отправить. Попробуй ещё раз.");
    });
  }

  return (
    <div
      role="dialog"
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
        <div
          style={{
            fontSize: "11px",
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            color: "var(--color-v2-ink-400)",
            marginBottom: "12px",
          }}
        >
          Пожаловаться на {targetFirstName}
        </div>
        <div
          style={{
            fontFamily: "var(--font-v2-display)",
            fontSize: "22px",
            lineHeight: "1.2",
            color: "var(--color-v2-ink-100)",
            marginBottom: "20px",
          }}
        >
          Что произошло?
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "20px" }}>
          {REASONS.map((r) => {
            const selected = reason === r.code;
            return (
              <button
                key={r.code}
                type="button"
                onClick={() => setReason(r.code)}
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  textAlign: "left",
                  fontFamily: "var(--font-v2-body)",
                  fontSize: "14px",
                  color: selected ? "var(--color-v2-paper)" : "var(--color-v2-ink-100)",
                  background: selected ? "var(--color-v2-ink-100)" : "transparent",
                  border: `1px solid ${selected ? "var(--color-v2-ink-100)" : "var(--color-v2-ink-500)"}`,
                  borderRadius: "var(--v2-radius-md)",
                  cursor: "pointer",
                  transition: "all 0.12s ease",
                }}
              >
                {r.label}
              </button>
            );
          })}
        </div>

        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value.slice(0, 1000))}
          placeholder="Подробности (по желанию)"
          rows={3}
          style={{
            width: "100%",
            padding: "12px 14px",
            fontFamily: "var(--font-v2-body)",
            fontSize: "14px",
            color: "var(--color-v2-ink-100)",
            background: "transparent",
            border: "1px solid var(--color-v2-ink-500)",
            borderRadius: "var(--v2-radius-md)",
            resize: "vertical",
            outline: "none",
            marginBottom: "16px",
          }}
        />

        {err ? (
          <div
            style={{
              padding: "10px 14px",
              background: "rgba(180, 50, 50, 0.08)",
              border: "1px solid rgba(180, 50, 50, 0.3)",
              borderRadius: "var(--v2-radius-md)",
              fontSize: "13px",
              color: "var(--color-v2-ink-200)",
              marginBottom: "12px",
            }}
          >
            {err}
          </div>
        ) : null}

        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <Button onClick={send} disabled={!reason || pending} variant="primary">
            {pending ? "Отправляю…" : "Отправить"}
          </Button>
          <Button onClick={onClose} disabled={pending} variant="ghost">
            Отмена
          </Button>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Block confirm
// =============================================================================

function BlockConfirm({
  firstName,
  onClose,
  onConfirm,
  pending,
}: {
  firstName: string;
  onClose: () => void;
  onConfirm: () => void;
  pending: boolean;
}) {
  return (
    <div
      role="dialog"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(10, 9, 8, 0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
        padding: "24px",
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
          borderRadius: "var(--v2-radius-lg)",
          padding: "32px 24px",
          fontFamily: "var(--font-v2-body)",
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-v2-display)",
            fontSize: "22px",
            lineHeight: "1.2",
            color: "var(--color-v2-ink-100)",
            marginBottom: "16px",
          }}
        >
          Заблокировать {firstName}?
        </div>
        <p
          style={{
            fontSize: "14px",
            lineHeight: "1.55",
            color: "var(--color-v2-ink-300)",
            marginBottom: "24px",
          }}
        >
          Ты не будешь видеть {firstName} в ленте. Чат закроется. Интересы
          между вами отзовутся. {firstName} не узнает об этом.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <Button onClick={onConfirm} disabled={pending} variant="primary">
            {pending ? "..." : "Заблокировать"}
          </Button>
          <Button onClick={onClose} disabled={pending} variant="ghost">
            Отмена
          </Button>
        </div>
      </div>
    </div>
  );
}
