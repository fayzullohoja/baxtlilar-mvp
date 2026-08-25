"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "./Button";
import { AnketaSubmitNotice } from "./AnketaSubmitNotice";
import { useAnketaSubmit } from "./useAnketaSubmit";
import { Field, Select, scrollToFirstError } from "./AnketaFields";
import {
  FAMILY_ROLE_MODEL,
  WIFE_WORK_VIEW,
  HOUSEHOLD_RESPONSIBILITY_MODEL,
} from "@/lib/profile/options";
import {
  type Gender,
} from "@/lib/profile/gender-wording";

/**
 * V3 Sprint 2 — Экран 7 «Семейная модель» (NEW).
 *
 * Поля (ревью оунера 1.4 — убран family_decision_model, дублировал модель семьи):
 * - family_role_model (hot, required) — традиционная / равное / др.
 * - wife_work_after_marriage_view (hot, required) — взгляд на работу жены
 * - household_responsibility_model (cold → extended, optional)
 *
 * gender (2026-06-30): используется для gender-wording — М-юзер видит
 * «В основном жена», Ж-юзер — «В основном муж» (см. gender-wording.ts).
 *
 * API: /api/onboarding/profile/family-model.
 */
export function V2AnketaFamilyModelForm({
  locale,
  gender,
  initial,
  endpoint,
  submitLabel,
}: {
  locale: string;
  gender: Gender | null;
  initial?: {
    family_role_model?: string;
    wife_work_after_marriage_view?: string;
    household_responsibility_model?: string;
  };
  /** Куда слать. Пусто - обычный шаг анкеты. */
  endpoint?: string;
  /** Подпись кнопки. Пусто - «Далее», как в анкете. */
  submitLabel?: string;
}) {
  const { busy, errorCode, stepMoved, submit: submitStep } = useAnketaSubmit(endpoint ?? "/api/onboarding/profile/family-model");
  const t = useTranslations("Anketa");
  const [roleModel, setRoleModel] = useState(initial?.family_role_model ?? "");
  const [wifeWork, setWifeWork] = useState(
    initial?.wife_work_after_marriage_view ?? "",
  );
  const [householdModel, setHouseholdModel] = useState(
    initial?.household_responsibility_model ?? "",
  );
  const [showErrors, setShowErrors] = useState(false);

  // §2 P0: эквивалент прежнего `!!roleModel && !!wifeWork` (household опционален).
  const errors: Record<string, string> = {};
  if (!roleModel) errors.family_role_model = t("err_select_required");
  if (!wifeWork) errors.wife_work_after_marriage_view = t("err_select_required");

  async function submit() {
    if (busy) return;
    if (Object.keys(errors).length) {
      setShowErrors(true);
      requestAnimationFrame(scrollToFirstError);
      return;
    }
    await submitStep({
      family_role_model: roleModel,
      wife_work_after_marriage_view: wifeWork,
      ...(householdModel
        ? { household_responsibility_model: householdModel }
        : {}),
    });
  }

  return (
    <div>
      <Field
        label={t('familyRoleModelLabel')}
        required
        hint={t('familyRoleModelHint')}
        error={showErrors ? errors.family_role_model : undefined}
      >
        <Select
          options={FAMILY_ROLE_MODEL}
          value={roleModel}
          onChange={setRoleModel}
          locale={locale}
        />
      </Field>

      <Field
        label={t(gender === 'f' ? 'husbandWorkLabel' : 'wifeWorkLabel')}
        required
        error={showErrors ? errors.wife_work_after_marriage_view : undefined}
      >
        <Select
          options={WIFE_WORK_VIEW}
          value={wifeWork}
          onChange={setWifeWork}
          locale={locale}
        />
      </Field>

      <Field
        label={t('householdResponsibilityLabel')}
        hint={t('canSkipHint')}
      >
        {/* Гендерный вариант лейбла — ключ Options.HOUSEHOLD_RESPONSIBILITY_MODEL.<v>__<m|f>
            (редактируется в админке), с откатом на код-оверрайд. */}
        <Select
          options={HOUSEHOLD_RESPONSIBILITY_MODEL}
          value={householdModel}
          onChange={setHouseholdModel}
          locale={locale}
          gender={gender}
        />
      </Field>

      <AnketaSubmitNotice errorCode={errorCode} stepMoved={stepMoved} />

      <Button onClick={submit} disabled={busy} variant="primary">
        {busy ? t('btn_saving') : (submitLabel ?? t("btn_next"))}
      </Button>
    </div>
  );
}
