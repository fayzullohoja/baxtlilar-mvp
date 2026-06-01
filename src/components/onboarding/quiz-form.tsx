"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { postJson } from "@/lib/client/api";
import { PrimaryButton } from "@/components/ui/screen";
import { QUESTIONS } from "@/lib/quiz/questions";

export function QuizForm() {
  const t = useTranslations("Quiz");
  const locale = useLocale();
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const allAnswered = QUESTIONS.every((q) => answers[q.id]);

  async function submit() {
    setBusy(true);
    setErr(null);
    const r = await postJson("/api/onboarding/quiz/complete", {
      answers: QUESTIONS.map((q) => ({ question_id: q.id, value: answers[q.id] })),
    });
    if (r.ok && r.next) router.push(r.next);
    else {
      setErr(t("err"));
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      {QUESTIONS.map((q, i) => (
        <div key={q.id}>
          <p className="text-sm text-baxt-navy mb-2">
            {i + 1}. {locale === "uz" ? q.uz : q.ru}
          </p>
          <div className="flex gap-1.5">
            {[1, 2, 3, 4, 5].map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setAnswers((a) => ({ ...a, [q.id]: v }))}
                className={
                  "flex-1 py-2 rounded-lg text-sm border transition-colors " +
                  (answers[q.id] === v
                    ? "bg-baxt-coral text-white border-baxt-coral"
                    : "bg-white text-baxt-navy border-baxt-border hover:border-baxt-coral")
                }
              >
                {v}
              </button>
            ))}
          </div>
          <div className="flex justify-between text-[10px] text-baxt-muted mt-1">
            <span>{t("scale_min")}</span>
            <span>{t("scale_max")}</span>
          </div>
        </div>
      ))}
      {err ? <p className="text-sm text-baxt-coral-dk">{err}</p> : null}
      <PrimaryButton onClick={submit} disabled={busy || !allAnswered}>
        {t("submit")}
      </PrimaryButton>
    </div>
  );
}
