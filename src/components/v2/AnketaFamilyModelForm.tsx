"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { Button } from "./Button";
import { Field, Select } from "./AnketaFields";
import {
  FAMILY_ROLE_MODEL,
  WIFE_WORK_VIEW,
  FAMILY_DECISION_MODEL,
  HOUSEHOLD_RESPONSIBILITY_MODEL,
} from "@/lib/profile/options";
import {
  type Gender,
} from "@/lib/profile/gender-wording";

/**
 * V3 Sprint 2 — Экран 7 «Семейная модель» (NEW).
 *
 * Поля:
 * - family_role_model (hot, required) — традиционная / равное / др.
 * - wife_work_after_marriage_view (hot, required) — взгляд на работу жены
 * - family_decision_model (cold → extended, optional)
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
}: {
  locale: string;
  gender: Gender | null;
  initial?: {
    family_role_model?: string;
    wife_work_after_marriage_view?: string;
    decision_model?: string;
    household_responsibility_model?: string;
  };
}) {
  const router = useRouter();
  const t = useTranslations("Anketa");
  const [roleModel, setRoleModel] = useState(initial?.family_role_model ?? "");
  const [wifeWork, setWifeWork] = useState(
    initial?.wife_work_after_marriage_view ?? "",
  );
  const [decisionModel, setDecisionModel] = useState(
    initial?.decision_model ?? "",
  );
  const [householdModel, setHouseholdModel] = useState(
    initial?.household_responsibility_model ?? "",
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/onboarding/profile/family-model", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          family_role_model: roleModel,
          wife_work_after_marriage_view: wifeWork,
          ...(decisionModel ? { family_decision_model: decisionModel } : {}),
          ...(householdModel
            ? { household_responsibility_model: householdModel }
            : {}),
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

  const valid = !!roleModel && !!wifeWork;

  return (
    <div>
      <Field
        label={t('familyRoleModelLabel')}
        required
        hint={t('familyRoleModelHint')}
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
      >
        <Select
          options={WIFE_WORK_VIEW}
          value={wifeWork}
          onChange={setWifeWork}
          locale={locale}
        />
      </Field>

      <Field
        label={t('familyDecisionLabel')}
        hint={t('optionalHint')}
      >
        <Select
          options={FAMILY_DECISION_MODEL}
          value={decisionModel}
          onChange={setDecisionModel}
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
          {t('err_failed')}
        </div>
      ) : null}

      <Button onClick={submit} disabled={busy || !valid} variant="primary">
        {busy ? t('btn_saving') : t('btn_next')}
      </Button>
    </div>
  );
}
