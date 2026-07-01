"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { Button } from "./Button";
import { Field, Select, Chips } from "./AnketaFields";
import {
  LIFESTYLE_PACE,
  FREE_TIME_ACTIVITIES,
  DAILY_ROUTINE,
  BAD_HABITS_LEVEL,
  NUTRITION_STYLE,
  ALCOHOL_LEVEL,
  DRUGS_USE,
} from "@/lib/profile/options";

/**
 * V4 (2026-06-30) — Чат 2 — Анкета.md Экран 10 «Образ жизни и привычки».
 *
 * 7 блоков по спеке:
 *  - lifestyle_pace (required) — активный / спокойный / сбалансированный / затрудняюсь
 *  - free_time_activities (required, 1-3) — как проводит свободное время
 *  - daily_routine (required) — режим дня
 *  - bad_habits_level (optional) — sensitive; скрывается до mutual interest
 *  - nutrition_style (optional)
 *  - alcohol_level (optional) — sensitive
 *  - drugs_use (optional) — sensitive
 *
 * Все поля пишутся в extended.lifestyle (cold jsonb). Sensitive поля
 * (habits/alcohol/drugs) не показываются публично даже после публикации —
 * gate на уровне рендера ProgressiveProfile.
 *
 * API: /api/onboarding/profile/lifestyle.
 * После сохранения: profile_lifestyle → profile_marriage.
 */
export function V2AnketaLifestyleForm({ locale }: { locale: string }) {
  const router = useRouter();
  const t = useTranslations("Anketa");
  const [pace, setPace] = useState("");
  const [freeTime, setFreeTime] = useState<string[]>([]);
  const [routine, setRoutine] = useState("");
  const [badHabits, setBadHabits] = useState("");
  const [nutrition, setNutrition] = useState("");
  const [alcohol, setAlcohol] = useState("");
  const [drugs, setDrugs] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function toggleFreeTime(v: string) {
    setFreeTime((cur) =>
      cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v],
    );
  }

  async function submit() {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/onboarding/profile/lifestyle", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          lifestyle_pace: pace,
          free_time_activities: freeTime,
          daily_routine: routine,
          ...(badHabits ? { bad_habits_level: badHabits } : {}),
          ...(nutrition ? { nutrition_style: nutrition } : {}),
          ...(alcohol ? { alcohol_level: alcohol } : {}),
          ...(drugs ? { drugs_use: drugs } : {}),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok: boolean;
        next?: string;
      };
      if (data.ok && data.next) {
        router.replace(data.next);
        return;
      }
      setErr("failed");
    } catch {
      setErr("failed");
    } finally {
      setBusy(false);
    }
  }

  const valid =
    !!pace &&
    !!routine &&
    freeTime.length >= 1 &&
    freeTime.length <= 3;

  return (
    <div>
      <Field label={t("lifestyle_pace_question")} required>
        <Select
          options={LIFESTYLE_PACE}
          value={pace}
          onChange={setPace}
          locale={locale}
        />
      </Field>

      <Field
        label={t("lifestyle_freetime_question")}
        required
        hint={`${t("lifestyle_freetime_hint")} ${freeTime.length}/3`}
      >
        <Chips
          options={FREE_TIME_ACTIVITIES}
          selected={freeTime}
          onToggle={toggleFreeTime}
          max={3}
          locale={locale}
        />
      </Field>

      <Field label={t("lifestyle_daily_routine_question")} required>
        <Select
          options={DAILY_ROUTINE}
          value={routine}
          onChange={setRoutine}
          locale={locale}
        />
      </Field>

      <Field
        label={t("lifestyle_bad_habits_question")}
        hint={t("canSkipHint")}
      >
        <Select
          options={BAD_HABITS_LEVEL}
          value={badHabits}
          onChange={setBadHabits}
          locale={locale}
        />
      </Field>

      <Field
        label={t("lifestyle_nutrition_question")}
        hint={t("canSkipHint")}
      >
        <Select
          options={NUTRITION_STYLE}
          value={nutrition}
          onChange={setNutrition}
          locale={locale}
        />
      </Field>

      <Field
        label={t("lifestyle_alcohol_question")}
        hint={t("canSkipHint")}
      >
        <Select
          options={ALCOHOL_LEVEL}
          value={alcohol}
          onChange={setAlcohol}
          locale={locale}
        />
      </Field>

      <Field
        label={t("lifestyle_drugs_question")}
        hint={t("canSkipHint")}
      >
        <Select
          options={DRUGS_USE}
          value={drugs}
          onChange={setDrugs}
          locale={locale}
        />
      </Field>

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
          {t("err_failed")}
        </div>
      ) : null}

      <Button onClick={submit} disabled={busy || !valid} variant="primary">
        {busy ? t("btn_saving") : t("btn_next")}
      </Button>
    </div>
  );
}
