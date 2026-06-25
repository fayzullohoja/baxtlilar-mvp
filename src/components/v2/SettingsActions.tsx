"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "./Button";

/**
 * V2 Settings Actions — pause/resume + delete account.
 *
 * Pause: lifecycle=paused, юзер невидим в фиде, не получает interest.
 * Existing chats работают (см. permissions paused — Sprint 5).
 *
 * Delete: irreversible erase_user RPC. Confirm через editorial dialog
 * (не native window.confirm).
 */

export function V2SettingsActions({ paused }: { paused: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [delConfirmOpen, setDelConfirmOpen] = useState(false);

  async function pauseToggle() {
    if (busy) return;
    setBusy(true);
    try {
      await fetch("/api/account", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: paused ? "resume" : "pause" }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function del() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/account", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "delete" }),
      });
      if (res.ok) {
        router.replace("/");
        return;
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <div>
          <Button onClick={pauseToggle} variant="secondary" disabled={busy}>
            {paused ? "Возобновить" : "Поставить на паузу"}
          </Button>
          <p
            style={{
              marginTop: "8px",
              fontSize: "12px",
              color: "var(--color-v2-ink-400)",
              fontFamily: "var(--font-v2-body)",
              lineHeight: "1.5",
            }}
          >
            {paused
              ? "На паузе: ты невидим(а) в подборе, не получаешь интересы. Существующие чаты остаются — можно отвечать."
              : "На паузе тебя не показывают в подборе. Существующие чаты остаются. Сними паузу в любой момент."}
          </p>
        </div>

        <div
          style={{
            marginTop: "32px",
            paddingTop: "24px",
            borderTop: "1px solid var(--color-v2-ink-500)",
          }}
        >
          <Button onClick={() => setDelConfirmOpen(true)} variant="ghost" disabled={busy}>
            Удалить аккаунт
          </Button>
          <p
            style={{
              marginTop: "8px",
              fontSize: "12px",
              color: "var(--color-v2-ink-400)",
              fontFamily: "var(--font-v2-body)",
              lineHeight: "1.5",
            }}
          >
            Анкета, фото и история удаляются необратимо. Номер блокируется
            от&nbsp;повторной регистрации на&nbsp;90&nbsp;дней.
          </p>
        </div>
      </div>

      {delConfirmOpen ? (
        <DeleteConfirm
          onClose={() => setDelConfirmOpen(false)}
          onConfirm={del}
          busy={busy}
        />
      ) : null}
    </>
  );
}

function DeleteConfirm({
  onClose,
  onConfirm,
  busy,
}: {
  onClose: () => void;
  onConfirm: () => void;
  busy: boolean;
}) {
  const [acked, setAcked] = useState(false);

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
        fontFamily: "var(--font-v2-body)",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        style={{
          background: "var(--color-v2-paper)",
          width: "100%",
          maxWidth: "var(--v2-max-width)",
          borderRadius: "var(--v2-radius-lg)",
          padding: "32px 24px",
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
          Удалить аккаунт?
        </div>
        <p
          style={{
            fontSize: "14px",
            lineHeight: "1.55",
            color: "var(--color-v2-ink-300)",
            marginBottom: "20px",
          }}
        >
          Анкета и&nbsp;все фото удаляются. История сообщений обезличивается.
          Номер блокируется на&nbsp;90&nbsp;дней — это анти-abuse правило.
        </p>

        <label
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: "10px",
            marginBottom: "24px",
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={acked}
            onChange={(e) => setAcked(e.target.checked)}
            style={{
              marginTop: "4px",
              width: "16px",
              height: "16px",
              accentColor: "var(--color-v2-ink-100)",
            }}
          />
          <span
            style={{
              fontSize: "13px",
              color: "var(--color-v2-ink-200)",
              lineHeight: "1.5",
            }}
          >
            Понимаю что это нельзя отменить.
          </span>
        </label>

        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <Button onClick={onConfirm} disabled={!acked || busy} variant="primary">
            {busy ? "Удаляю…" : "Удалить навсегда"}
          </Button>
          <Button onClick={onClose} disabled={busy} variant="ghost">
            Отмена
          </Button>
        </div>
      </div>
    </div>
  );
}
