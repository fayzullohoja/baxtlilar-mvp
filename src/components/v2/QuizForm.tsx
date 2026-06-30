"use client";

import { useState } from "react";
import { useTranslations } from 'next-intl';
import { useRouter } from "@/i18n/navigation";
import { Button } from "./Button";
import { QUESTIONS } from "@/lib/quiz/questions";

/**
 * V2 Quiz (Blueprint §3.3 B7).
 *
 * 10 вопросов Big Five (O/C/E/A/ES). Шкала 1-5. Editorial-стиль:
 * вопросы как нумерованные параграфы, шкала — крупные кнопки в строку.
 *
 * Не paginate (one-at-a-time): 10 вопросов помещаются в один скролл, и
 * пользователь может «вернуться и переспросить».
 *
 * API: POST /api/onboarding/quiz/complete с answers[].
 */

const SCALE_LABELS = { min: "scale_min", max: "scale_max" };

export function V2QuizForm({ locale }: { locale: string }) {
  const t = useTranslations('Quiz');
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const allAnswered = QUESTIONS.every((q) => answers[q.id]);
  const progress = Object.keys(answers).length;

  async function submit() {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/onboarding/quiz/complete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          answers: QUESTIONS.map((q) => ({
            question_id: q.id,
            value: answers[q.id],
          })),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok: boolean; next?: string };
      if (data.ok && data.next) {
        router.replace(data.next);
        return;
      }
      setErr(t('err_save_failed'));
    } catch {
      setErr(t('err_something_wrong'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div
        style={{
          fontFamily: "var(--font-v2-body)",
          fontSize: "12px",
          color: "var(--color-v2-ink-400)",
          marginBottom: "32px",
        }}
      >
        {t('progress', { progress, total: QUESTIONS.length })}
      </div>

      {QUESTIONS.map((q, i) => (
        <div key={q.id} style={{ marginBottom: "40px" }}>
          <p
            style={{
              fontFamily: "var(--font-v2-body)",
              fontSize: "17px",
              lineHeight: "1.45",
              color: "var(--color-v2-ink-100)",
              marginBottom: "16px",
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-v2-display)",
                color: "var(--color-v2-ink-400)",
                marginRight: "8px",
              }}
            >
              {String(i + 1).padStart(2, "0")}
            </span>
            {locale === "uz" ? q.uz : q.ru}
          </p>
          <div style={{ display: "flex", gap: "6px" }}>
            {[1, 2, 3, 4, 5].map((v) => {
              const selected = answers[q.id] === v;
              return (
                <button
                  key={v}
                  type="button"
                  onClick={() => setAnswers((a) => ({ ...a, [q.id]: v }))}
                  style={{
                    flex: 1,
                    padding: "12px 0",
                    fontFamily: "var(--font-v2-display)",
                    fontSize: "16px",
                    color: selected ? "var(--color-v2-paper)" : "var(--color-v2-ink-200)",
                    background: selected ? "var(--color-v2-ink-100)" : "transparent",
                    border: `1px solid ${selected ? "var(--color-v2-ink-100)" : "var(--color-v2-ink-500)"}`,
                    borderRadius: "var(--v2-radius-md)",
                    cursor: "pointer",
                    transition: "all 0.12s ease",
                  }}
                >
                  {v}
                </button>
              );
            })}
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: "11px",
              color: "var(--color-v2-ink-400)",
              fontFamily: "var(--font-v2-body)",
              marginTop: "6px",
            }}
          >
            <span>{t(SCALE_LABELS.min)}</span>
            <span>{t(SCALE_LABELS.max)}</span>
          </div>
        </div>
      ))}

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
            marginBottom: "16px",
          }}
        >
          {err}
        </div>
      ) : null}

      <Button onClick={submit} disabled={busy || !allAnswered} variant="primary">
        {busy ? t('saving') : allAnswered ? t('done') : t('remaining', { count: QUESTIONS.length - progress })}
      </Button>
    </div>
  );
}
