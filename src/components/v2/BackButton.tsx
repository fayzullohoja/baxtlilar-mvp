"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";

/**
 * Кнопка «Назад» для шагов онбординга/анкеты. POST /api/onboarding/back
 * двигает onboarding_step на предыдущий шаг (ONBOARDING_BACK) и переводит туда.
 * Экраны хидратятся сохранёнными ответами, так что назад = увидеть/поправить.
 * variant="dark" — для тёмных экранов (quiz).
 */
export function BackButton({
  variant = "light",
}: {
  variant?: "light" | "dark";
}) {
  const router = useRouter();
  const t = useTranslations("Anketa");
  const [busy, setBusy] = useState(false);

  async function goBack() {
    if (busy) return;
    setBusy(true);
    try {
      const r = await fetch("/api/onboarding/back", { method: "POST" });
      const data = (await r.json().catch(() => ({}))) as {
        ok: boolean;
        next?: string;
      };
      if (data.ok && data.next) {
        router.replace(data.next);
        return;
      }
    } catch {
      /* сеть упала — оставляем на месте */
    }
    setBusy(false);
  }

  const color =
    variant === "dark"
      ? "rgba(255, 247, 240, 0.72)"
      : "var(--color-v2-ink-400)";

  return (
    <button
      type="button"
      onClick={goBack}
      disabled={busy}
      aria-label={t("back")}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        background: "none",
        border: "none",
        padding: "6px 0",
        cursor: busy ? "default" : "pointer",
        color,
        fontFamily: "var(--font-v2-body)",
        fontSize: "14px",
        fontWeight: 600,
        opacity: busy ? 0.5 : 1,
      }}
    >
      <span aria-hidden="true" style={{ fontSize: "18px", lineHeight: 1 }}>
        ←
      </span>
      {t("back")}
    </button>
  );
}
