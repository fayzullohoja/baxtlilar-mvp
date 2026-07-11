"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { Button } from "./Button";

/**
 * V2 Publish — финальное действие на /v2/anketa/preview.
 * POST /api/onboarding/profile/publish → transition в quiz.
 *
 * Ревью оунера: пока верификация НЕ approved, кнопка честно говорит «Отправить
 * на проверку» (анкета видима в подборе только после подтверждения личности),
 * и «Опубликовать» — когда уже approved. Все строки локализованы (ru/uz/tr).
 */

export function V2PublishButton({
  verificationStatus,
}: {
  verificationStatus?: string;
}) {
  const router = useRouter();
  const t = useTranslations("Anketa");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const isApproved = verificationStatus === "approved";

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
        setErr(t("error_gender_mismatch"));
        return;
      }
      setErr(t("error_publish_failed"));
    } catch {
      setErr(t("error_publish_generic"));
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
        {busy
          ? isApproved
            ? t("publish_button_approved")
            : t("publish_button_pending")
          : isApproved
            ? t("publish_label_approved")
            : t("publish_label_pending")}
      </Button>
    </div>
  );
}
