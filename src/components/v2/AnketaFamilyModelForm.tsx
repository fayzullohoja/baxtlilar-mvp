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

/**
 * V3 Sprint 2 — Экран 7 «Семейная модель» (NEW).
 *
 * Поля:
 * - family_role_model (hot, required) — традиционная / равное / др.
 * - wife_work_after_marriage_view (hot, required) — взгляд на работу жены
 * - family_decision_model (cold → extended, optional)
 * - household_responsibility_model (cold → extended, optional)
 *
 * API: /api/onboarding/profile/family-model.
 */
export function V2AnketaFamilyModelForm({ locale }: { locale: string }) {
  const router = useRouter();
  const t = useTranslations("Anketa");
  const [roleModel, setRoleModel] = useState("");
  const [wifeWork, setWifeWork] = useState("");
  const [decisionModel, setDecisionModel] = useState("");
  const [householdModel, setHouseholdModel] = useState("");
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

      <Field label={t('wifeWorkLabel')} required>
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
        <Select
          options={HOUSEHOLD_RESPONSIBILITY_MODEL}
          value={householdModel}
          onChange={setHouseholdModel}
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
          {t('Anketa.err_failed')}
        </div>
      ) : null}

      <Button onClick={submit} disabled={busy || !valid} variant="primary">
        {busy ? t('btn_saving') : t('btn_next')}
      </Button>
    </div>
  );
}
