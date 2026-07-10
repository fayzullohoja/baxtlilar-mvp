"use client";

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { Button } from "./Button";

/**
 * V2 VerificationIntroCta — кнопка «Поехали» на /v2/verify/intro.
 *
 * POST /api/onboarding/verification-intro/continue → state machine
 * переход verification_intro → doc_upload. На success или 409 (race из
 * другой вкладки) — на /v2/verify/doc.
 */

export function VerificationIntroCta() {
  const router = useRouter();
  const t = useTranslations("Verify");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onClick() {
    if (pending) return;
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/onboarding/verification-intro/continue", {
        method: "POST",
        headers: { "content-type": "application/json" },
      });
      if (res.ok || res.status === 409) {
        router.replace("/v2/verify/doc");
        return;
      }
      setError(t("ctaError"));
    });
  }

  return (
    <div className="flex flex-col gap-2">
      {error ? (
        <div
          style={{
            padding: "10px 14px",
            background: "#FBE7E4",
            borderLeft: "3px solid var(--color-v2-danger)",
            borderRadius: "12px",
            fontSize: "13px",
            color: "#9A4B46",
            fontFamily: "var(--font-v2-body)",
            marginBottom: "8px",
          }}
        >
          {error}
        </div>
      ) : null}
      <Button onClick={onClick} disabled={pending} variant="primary">
        {pending ? t("ctaPending") : t("consent_cta")}
      </Button>
    </div>
  );
}
