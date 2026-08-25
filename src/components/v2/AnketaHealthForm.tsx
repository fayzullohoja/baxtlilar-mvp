"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "./Button";
import { Field, Select } from "./AnketaFields";
import { AnketaSubmitNotice } from "./AnketaSubmitNotice";
import { useAnketaSubmit } from "./useAnketaSubmit";
import { HEALTH_OPENNESS, MEDICAL_CHECK_WILLINGNESS, DRUGS_USE } from "@/lib/profile/options";

/**
 * §11 «Здоровье и особые обстоятельства» (ревью оунера 2026-07-14).
 * Оба поля optional (чувствительные — можно пропустить). COLD → extended.health.
 * Baxtlilar НЕ собирает диагнозы/справки/результаты. API: /api/onboarding/profile/health.
 */
export function V2AnketaHealthForm({
  locale,
  initial,
  endpoint,
  submitLabel,
}: {
  locale: string;
  initial?: {
    health_openness?: string;
    medical_check_willingness?: string;
    substance_dependency_status?: string;
  };
  /** Куда слать. Пусто - обычный шаг анкеты. */
  endpoint?: string;
  /** Подпись кнопки. Пусто - «Далее», как в анкете. */
  submitLabel?: string;
}) {
  const t = useTranslations("Anketa");
  const { busy, errorCode, stepMoved, submit: submitStep } = useAnketaSubmit(endpoint ?? "/api/onboarding/profile/health");
  const [openness, setOpenness] = useState(initial?.health_openness ?? "");
  const [medical, setMedical] = useState(initial?.medical_check_willingness ?? "");
  const [substance, setSubstance] = useState(
    initial?.substance_dependency_status ?? "",
  );

  async function submit() {
    if (busy) return;
    await submitStep({
      ...(openness ? { health_openness: openness } : {}),
      ...(medical ? { medical_check_willingness: medical } : {}),
      ...(substance ? { substance_dependency_status: substance } : {}),
    });
  }

  return (
    <div>
      <Field label={t("health_openness_question")} hint={t("optionalHint")}>
        <Select
          options={HEALTH_OPENNESS}
          value={openness}
          onChange={setOpenness}
          locale={locale}
        />
      </Field>

      <Field
        label={t("medical_check_question")}
        hint={t("medical_check_hint")}
      >
        <Select
          options={MEDICAL_CHECK_WILLINGNESS}
          value={medical}
          onChange={setMedical}
          locale={locale}
        />
      </Field>

      {/* §1.10 substance — safety_only, не показывается другим юзерам. */}
      <Field label={t("substance_question")} hint={t("substance_hint")}>
        <Select
          options={DRUGS_USE}
          value={substance}
          onChange={setSubstance}
          locale={locale}
          placeholder="—"
        />
      </Field>

      <AnketaSubmitNotice errorCode={errorCode} stepMoved={stepMoved} />

      <Button onClick={submit} disabled={busy} variant="primary">
        {busy ? t("btn_saving") : (submitLabel ?? t("btn_next"))}
      </Button>
    </div>
  );
}
