"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button } from "./Button";

/**
 * V2 Attribution (Blueprint §3.3 B8).
 *
 * Последний шаг — откуда юзер пришёл. Источники из MAJOR #3 spec.
 * Skip разрешён — не блокируем прогресс.
 *
 * API: POST /api/onboarding/attribution { source, skip }.
 */

const SOURCES = [
  { value: "telegram", label: "Telegram-канал" },
  { value: "instagram", label: "Instagram" },
  { value: "friends", label: "Друзья / знакомые" },
  { value: "facebook", label: "Facebook" },
  { value: "tiktok", label: "TikTok" },
  { value: "youtube", label: "YouTube" },
  { value: "ads", label: "Реклама" },
  { value: "search", label: "Поиск Google / Яндекс" },
  { value: "media", label: "СМИ / статья" },
  { value: "event", label: "Мероприятие" },
  { value: "other", label: "Другое" },
] as const;

type Source = (typeof SOURCES)[number]["value"];

export function V2AttributionForm() {
  const t = useTranslations("Onboarding");
  const router = useRouter();
  const [selected, setSelected] = useState<Source | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(payload: { source?: Source; skip?: boolean }) {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/onboarding/attribution", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => ({}))) as { ok: boolean; next?: string };
      if (data.ok && data.next) {
        router.replace(data.next);
        return;
      }
      setErr(t("attr_error"));
    } catch {
      setErr(t("attr_error"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "24px" }}>
        {SOURCES.map((src) => {
          const isSelected = selected === src.value;
          return (
            <button
              key={src.value}
              type="button"
              onClick={() => setSelected(src.value)}
              style={{
                width: "100%",
                padding: "14px 16px",
                textAlign: "left",
                fontFamily: "var(--font-v2-body)",
                fontSize: "15px",
                fontWeight: isSelected ? 700 : 500,
                color: isSelected ? "#fff" : "var(--color-v2-ink-200)",
                background: isSelected ? "var(--color-v2-accent)" : "#fff",
                border: `1px solid ${isSelected ? "var(--color-v2-accent)" : "var(--color-v2-ink-500)"}`,
                borderRadius: "var(--v2-radius-md)",
                boxShadow: isSelected ? "var(--v2-shadow-cta)" : "none",
                cursor: "pointer",
                transition: "all 0.12s ease",
              }}
            >
              {t(src.label as any)}
            </button>
          );
        })}
      </div>

      {err ? (
        <div
          style={{
            padding: "10px 14px",
            background: "#FBE7E4",
            borderLeft: "3px solid var(--color-v2-danger)",
            borderRadius: "12px",
            fontSize: "13px",
            color: "#9A4B46",
            fontFamily: "var(--font-v2-body)",
            marginBottom: "16px",
          }}
        >
          {err}
        </div>
      ) : null}

      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <Button
          onClick={() => selected && submit({ source: selected })}
          disabled={!selected || busy}
          variant="primary"
        >
          {busy ? t("attr_cta_pending") : t("attr_cta")}
        </Button>
        <Button
          onClick={() => submit({ skip: true })}
          disabled={busy}
          variant="ghost"
        >
          {t("attr_skip")}
        </Button>
      </div>
    </div>
  );
}
