"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "./Button";
import { AnketaSubmitNotice } from "./AnketaSubmitNotice";
import { useAnketaSubmit } from "./useAnketaSubmit";

/**
 * V2 Attribution (Blueprint §3.3 B8).
 *
 * Последний шаг — откуда юзер пришёл. Источники из MAJOR #3 spec.
 * Skip разрешён — не блокируем прогресс.
 *
 * API: POST /api/onboarding/attribution { source, skip }.
 *
 * Отправка через общий слой (useAnketaSubmit): шаг стоит внутри той же цепочки,
 * что и анкета, и на 409 wrong_step (например после «перезапустить онбординг»)
 * человека надо уводить на его настоящий экран, а не предлагать повтор, который
 * не сработает никогда.
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
  { value: "influencer", label: "Блогер / инфлюэнсер" },
  { value: "other", label: "Другое" },
] as const;

type Source = (typeof SOURCES)[number]["value"];

export function V2AttributionForm() {
  const t = useTranslations("Onboarding");
  const { busy, errorCode, stepMoved, submit: submitAttr } = useAnketaSubmit(
    "/api/onboarding/attribution",
  );
  const [selected, setSelected] = useState<Source | null>(null);

  // Свой текст у экрана один на все коды - как и было до общего слоя.
  const ERR_COPY: Record<string, string> = { failed: t("attr_error") };

  async function submit(payload: { source?: Source; skip?: boolean }) {
    if (busy) return;
    await submitAttr(payload);
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
              {t(`attr_${src.value}`)}
            </button>
          );
        })}
      </div>

      <AnketaSubmitNotice errorCode={errorCode} stepMoved={stepMoved} errorCopy={ERR_COPY} />

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
