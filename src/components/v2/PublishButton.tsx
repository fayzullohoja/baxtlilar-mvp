"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "./Button";

/**
 * V2 Publish — финальное действие на /v2/anketa/preview.
 * POST /api/onboarding/profile/publish → transition в quiz.
 */

export function V2PublishButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function publish() {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/onboarding/profile/publish", {
        method: "POST",
        headers: { "content-type": "application/json" },
      });
      const data = (await res.json().catch(() => ({}))) as { ok: boolean; next?: string };
      if (data.ok && data.next) {
        router.replace(data.next);
        return;
      }
      setErr("Не получилось опубликовать. Проверьте анкету и попробуйте ещё раз.");
    } catch {
      setErr("Что-то пошло не так. Попробуйте ещё раз.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {err ? (
        <div
          style={{
            padding: "10px 14px",
            background: "rgba(180, 50, 50, 0.08)",
            border: "1px solid rgba(180, 50, 50, 0.3)",
            borderRadius: "var(--v2-radius-md)",
            fontSize: "13px",
            color: "var(--color-v2-ink-200)",
            fontFamily: "var(--font-v2-body)",
            marginBottom: "12px",
          }}
        >
          {err}
        </div>
      ) : null}
      <Button onClick={publish} disabled={busy} variant="primary">
        {busy ? "Публикую…" : "Опубликовать"}
      </Button>
    </div>
  );
}
