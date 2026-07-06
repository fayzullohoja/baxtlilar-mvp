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
      const data = (await res.json().catch(() => ({}))) as {
        ok: boolean;
        next?: string;
        error?: string;
      };
      if (data.ok && data.next) {
        router.replace(data.next);
        return;
      }
      // C6: пол в анкете не совпал с паспортом — это не «поправьте анкету»,
      // менять пол пользователь не может, нужен оператор.
      if (data.error === "gender_mismatch") {
        setErr(
          "Пол в анкете не совпадает с данными паспорта. Напишите в поддержку " +
            "@baxtlilar_support — оператор поможет.",
        );
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
            background: "#FBE7E4",
            borderLeft: "3px solid var(--color-v2-danger)",
            borderRadius: "12px",
            fontSize: "13px",
            fontWeight: 600,
            color: "#9A4B46",
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
