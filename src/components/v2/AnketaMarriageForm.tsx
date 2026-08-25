"use client";

import { useState } from "react";
import { Button } from "./Button";
import { AnketaSubmitNotice } from "./AnketaSubmitNotice";
import { useAnketaSubmit } from "./useAnketaSubmit";
import { Field, Select, scrollToFirstError } from "./AnketaFields";
import { POST_MARRIAGE_LIVING, MARRIAGE_READINESS, RELOCATION_READINESS } from "@/lib/profile/options";
import type { Gender } from "@/lib/profile/gender-wording";
import { useTranslations } from 'next-intl';

/**
 * V2 ext 2026-06-28: новый шаг анкеты — формат проживания после брака.
 * Между values и looking-for. Ключевой матчинг-сигнал для serious-marriage
 * платформы. API: /api/onboarding/profile/marriage.
 *
 * gender (ревью оунера 1.11): «С семьёй мужа/жены» звучит по-разному для М/Ж —
 * лейблы POST_MARRIAGE_LIVING адаптируются по полу (см. gender-wording.ts).
 */
export function V2AnketaMarriageForm({
  locale,
  gender,
  initial,
  endpoint,
  submitLabel,
}: {
  locale: string;
  gender: Gender | null;
  initial?: {
    post_marriage_living?: string;
    marriage_readiness?: string;
    relocation_readiness?: string;
  };
  /** Куда слать. Пусто - обычный шаг анкеты. */
  endpoint?: string;
  /** Подпись кнопки. Пусто - «Далее», как в анкете. */
  submitLabel?: string;
}) {
  const { busy, errorCode, stepMoved, submit: submitStep } = useAnketaSubmit(endpoint ?? "/api/onboarding/profile/marriage");
  const t = useTranslations('Anketa');
  const [living, setLiving] = useState(initial?.post_marriage_living ?? "");
  const [readiness, setReadiness] = useState(initial?.marriage_readiness ?? "");
  const [relocation, setRelocation] = useState(initial?.relocation_readiness ?? "");
  const [showErrors, setShowErrors] = useState(false);

  // §2 P0: эквивалент прежнего `!living`-гейта (readiness/relocation опциональны).
  const errors: Record<string, string> = {};
  if (!living) errors.post_marriage_living = t("err_select_required");

  async function submit() {
    if (busy) return;
    if (Object.keys(errors).length) {
      setShowErrors(true);
      requestAnimationFrame(scrollToFirstError);
      return;
    }
    await submitStep({
      post_marriage_living: living,
      ...(readiness ? { marriage_readiness: readiness } : {}),
      ...(relocation ? { relocation_readiness: relocation } : {}),
    });
  }

  return (
    <div>
      <Field
        label={t('marriage_format_label')}
        required
        hint={t('marriage_format_hint')}
        error={showErrors ? errors.post_marriage_living : undefined}
      >
        <Select
          options={POST_MARRIAGE_LIVING}
          value={living}
          onChange={setLiving}
          locale={locale}
          gender={gender}
        />
      </Field>

      <Field label={t('marriage_readiness_label')} hint={t('marriage_readiness_hint')}>
        <Select
          options={MARRIAGE_READINESS}
          value={readiness}
          onChange={setReadiness}
          locale={locale}
        />
      </Field>

      <Field label={t('relocation_readiness_label')} hint={t('relocation_readiness_hint')}>
        <Select
          options={RELOCATION_READINESS}
          value={relocation}
          onChange={setRelocation}
          locale={locale}
        />
      </Field>

      <AnketaSubmitNotice
        errorCode={errorCode}
        stepMoved={stepMoved}
        errorCopy={{ failed: t('marriage_format_save_err') }}
      />

      <Button
        variant="primary"
        onClick={submit}
        disabled={busy}
        style={{ width: "100%" }}
      >
        {busy ? t('marriage_format_saving') : (submitLabel ?? t("marriage_format_next"))}
      </Button>
    </div>
  );
}
