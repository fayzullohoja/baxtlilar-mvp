"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "./Button";
import { AnketaSubmitNotice } from "./AnketaSubmitNotice";
import { useAnketaSubmit } from "./useAnketaSubmit";
import { Field, Select, Chips, scrollToFirstError } from "./AnketaFields";
import {
  RELIGION,
  LIFE_VALUES_V3,
} from "@/lib/profile/options";

/**
 * V2 Anketa Values form (Blueprint §3.3 B3).
 * Поля: религия, ценности (1-3).
 *
 * V4 (2026-06-30): убран follow-up religion_practice («как Вы с этим живёте») —
 * учредительская поправка №5. Также убран religion_partner_match — переехал в
 * partner-extended (учредительская поправка №10: раздел «Кого ищу»).
 * API: /api/onboarding/profile/values.
 */

export function V2AnketaValuesForm({
  locale,
  initial,
  endpoint,
  submitLabel,
}: {
  locale: string;
  initial?: {
    religion?: string;
    top_life_values?: string[];
  };
  /** Куда слать. Пусто - обычный шаг анкеты. */
  endpoint?: string;
  /** Подпись кнопки. Пусто - «Далее», как в анкете. */
  submitLabel?: string;
}) {
  const t = useTranslations('Anketa');
  const { busy, errorCode, stepMoved, submit: submitStep } = useAnketaSubmit(endpoint ?? "/api/onboarding/profile/values");
  const [religion, setReligion] = useState(initial?.religion ?? "");
  const [values, setValues] = useState<string[]>(initial?.top_life_values ?? []);
  const [showErrors, setShowErrors] = useState(false);

  // §2 P0: эквивалент прежнего `valid` (values 1-5; max=5 обеспечивает Chips).
  const errors: Record<string, string> = {};
  if (values.length < 1) errors.top_life_values = t("err_select_required");

  function toggle(v: string) {
    setValues((cur) => (cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]));
  }

  async function submit() {
    if (busy) return;
    if (Object.keys(errors).length) {
      setShowErrors(true);
      requestAnimationFrame(scrollToFirstError);
      return;
    }
    await submitStep({
      // Вера опциональна - отправляем только если выбрана (пустую не шлём).
      ...(religion ? { religion } : {}),
      top_life_values: values,
    });
  }

  return (
    <div>
      <Field label={t('religionLabel')} hint={t('optionalHint')}>
        <Select options={RELIGION} value={religion} onChange={setReligion} locale={locale} />
      </Field>

      <Field
        label={t('lifeValuesLabel')}
        required
        hint={t('lifeValuesHint')! + ` ${values.length}/3`}
        error={showErrors ? errors.top_life_values : undefined}
      >
        <Chips options={LIFE_VALUES_V3} selected={values} onToggle={toggle} max={5} locale={locale} />
      </Field>

      <AnketaSubmitNotice errorCode={errorCode} stepMoved={stepMoved} />

      <Button onClick={submit} disabled={busy} variant="primary">
        {busy ? t('btn_saving') : (submitLabel ?? t("btn_next"))}
      </Button>
    </div>
  );
}
