"use client";

import { useState, useEffect } from "react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "./Button";
import { useTranslations } from 'next-intl'

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
  const t = useTranslations('Settings');
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
        <div
          className="v2-rise"
          style={{
            background: "#fff",
            borderRadius: "16px",
            boxShadow: "var(--v2-shadow-card)",
            padding: "18px 16px",
          }}
        >
          <Button onClick={pauseToggle} variant="secondary" disabled={busy}>
            {paused ? t('actions_resume') : t('actions_pause')}
          </Button>
          <p
            style={{
              marginTop: "10px",
              fontSize: "12px",
              color: "var(--color-v2-ink-400)",
              fontFamily: "var(--font-v2-body)",
              lineHeight: "1.5",
            }}
          >
            {paused
              ? t('actions_paused_desc')
              : t('actions_pause_desc')}
          </p>
        </div>

        <div
          className="v2-rise"
          style={{
            marginTop: "16px",
            background: "#fff",
            borderRadius: "16px",
            boxShadow: "var(--v2-shadow-card)",
            padding: "18px 16px",
          }}
        >
          <Button
            onClick={() => setDelConfirmOpen(true)}
            variant="ghost"
            disabled={busy}
            style={{ color: "var(--color-v2-danger)" }}
          >
            {t('actions_delete')}
          </Button>
          <p
            style={{
              marginTop: "10px",
              fontSize: "12px",
              color: "var(--color-v2-ink-400)",
              fontFamily: "var(--font-v2-body)",
              lineHeight: "1.5",
            }}
          >
            {t('actions_delete_desc')}
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
  const t = useTranslations("Settings");
  const [acked, setAcked] = useState(false);

  // Bug #35 (loop pass 10): a11y — добавлен aria-modal, Escape-key handler.
  // Полноценный focus trap здесь не реализуем (требует focus-trap-react),
  // но keyboard-Escape для закрытия — минимум для пользователя клавиатуры.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-confirm-title"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(42, 26, 46, 0.55)",
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
        className="v2-rise"
        style={{
          background: "#fff",
          width: "100%",
          maxWidth: "var(--v2-max-width)",
          borderRadius: "var(--v2-radius-card)",
          boxShadow: "var(--v2-shadow-card-lg)",
          padding: "32px 24px",
        }}
      >
        <div
          id="delete-confirm-title"
          style={{
            fontFamily: "var(--font-v2-display)",
            fontWeight: 800,
            fontSize: "22px",
            lineHeight: "1.2",
            color: "var(--color-v2-ink-100)",
            marginBottom: "16px",
          }}
        >
          {t('actions_delete_confirm_title')}
        </div>
        <p
          style={{
            fontSize: "14px",
            lineHeight: "1.55",
            color: "var(--color-v2-ink-300)",
            marginBottom: "20px",
          }}
        >
          {t('actions_delete_confirm_desc')}
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
              accentColor: "var(--color-v2-accent)",
            }}
          />
          <span
            style={{
              fontSize: "13px",
              color: "var(--color-v2-ink-200)",
              lineHeight: "1.5",
            }}
          >
            {t('actions_delete_ack')}
          </span>
        </label>

        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <Button onClick={onConfirm} disabled={!acked || busy} variant="primary">
            {busy ? t('actions_delete_busy') : t('actions_delete_final')}
          </Button>
          <Button onClick={onClose} disabled={busy} variant="ghost">
            {t('actions_cancel')}
          </Button>
        </div>
      </div>
    </div>
  );
}
