"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "./Button";
import { Field, Select, Chips, scrollToFirstError } from "./AnketaFields";
import { AnketaSubmitNotice } from "./AnketaSubmitNotice";
import { useAnketaSubmit } from "./useAnketaSubmit";
import {
  LIFESTYLE_PACE,
  FREE_TIME_ACTIVITIES,
  DAILY_ROUTINE,
  BAD_HABITS_LEVEL,
  NUTRITION_STYLE,
  ALCOHOL_LEVEL,
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
export function V2AnketaLifestyleForm({
  locale,
  initial,
}: {
  locale: string;
  initial?: {
    lifestyle_pace?: string;
    free_time_activities?: string[];
    daily_routine?: string;
    bad_habits_level?: string;
    nutrition_style?: string;
    alcohol_level?: string;
  };
}) {
  const t = useTranslations("Anketa");
  const { busy, errorCode, stepMoved, submit: submitStep } = useAnketaSubmit(
    "/api/onboarding/profile/lifestyle",
  );
  const [pace, setPace] = useState(initial?.lifestyle_pace ?? "");
  const [freeTime, setFreeTime] = useState<string[]>(
    initial?.free_time_activities ?? [],
  );
  const [routine, setRoutine] = useState(initial?.daily_routine ?? "");
  const [badHabits, setBadHabits] = useState(initial?.bad_habits_level ?? "");
  const [nutrition, setNutrition] = useState(initial?.nutrition_style ?? "");
  const [alcohol, setAlcohol] = useState(initial?.alcohol_level ?? "");
  const [showErrors, setShowErrors] = useState(false);

  // §2 P0: эквивалент прежнего valid (pace + routine + freeTime 1-3; прочее опц.).
  const errors: Record<string, string> = {};
  if (!pace) errors.lifestyle_pace = t("err_select_required");
  if (freeTime.length < 1) errors.free_time_activities = t("err_select_required");
  if (!routine) errors.daily_routine = t("err_select_required");

  function toggleFreeTime(v: string) {
    setFreeTime((cur) =>
      cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v],
    );
  }

  async function submit() {
    if (busy) return;
    if (Object.keys(errors).length) {
      setShowErrors(true);
      requestAnimationFrame(scrollToFirstError);
      return;
    }
    await submitStep({
      lifestyle_pace: pace,
      free_time_activities: freeTime,
      daily_routine: routine,
      ...(badHabits ? { bad_habits_level: badHabits } : {}),
      ...(nutrition ? { nutrition_style: nutrition } : {}),
      ...(alcohol ? { alcohol_level: alcohol } : {}),
      // drugs_use убран из анкеты (ревью оунера) - вопрос переносится в Правила.
    });
  }

  return (
    <div>
      <Field label={t("lifestyle_pace_question")} required error={showErrors ? errors.lifestyle_pace : undefined}>
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
        error={showErrors ? errors.free_time_activities : undefined}
      >
        <Chips
          options={FREE_TIME_ACTIVITIES}
          /* T-104: макс. выбор увеличен с 3 до 5 */
          selected={freeTime}
          onToggle={toggleFreeTime}
          max={5}
          locale={locale}
        />
      </Field>

      <Field label={t("lifestyle_daily_routine_question")} required error={showErrors ? errors.daily_routine : undefined}>
        <Select
          options={DAILY_ROUTINE}
          value={routine}
          onChange={setRoutine}
          locale={locale}
        />
      </Field>

      <Field
        label={t("lifestyle_bad_habits_question")}
        hint={t("lifestyle_smoking_hint")}
      >
        <Select
          options={BAD_HABITS_LEVEL}
          value={badHabits}
          onChange={setBadHabits}
          locale={locale}
        />
      </Field>

      {/* Спек 1.9: порядок курение → алкоголь → питание. */}
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

      {/* Вопрос о запрещённых веществах убран из анкеты (ревью оунера): он
          юридически чувствителен и почти никогда не заполняется честно —
          переносится в Правила платформы + safety-модерацию. */}

      <AnketaSubmitNotice errorCode={errorCode} stepMoved={stepMoved} />

      <Button onClick={submit} disabled={busy} variant="primary">
        {busy ? t("btn_saving") : t("btn_next")}
      </Button>
    </div>
  );
}
