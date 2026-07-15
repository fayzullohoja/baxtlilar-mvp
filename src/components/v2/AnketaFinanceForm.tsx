"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button } from "./Button";
import { Field, Select, NumberScale, scrollToFirstError } from "./AnketaFields";
import {
  INCOME_SOURCE_STABILITY,
  FAMILY_FINANCE_MANAGEMENT,
  MONTHLY_INCOME_RANGE,
  HOUSING_STATUS,
} from "@/lib/profile/options";

/**
 * V4 (2026-06-30) — Чат 2 — Анкета.md Экран 9 «Финансы и материальная стабильность».
 *
 * Все 6 полей — cold (extended.finance). Экран hidden public по спеке;
 * видимость профиля — глобальный дефолт 'verified_only' (экран privacy убран 2026-07-12).
 *
 * Блоки (ревью оунера 1.6 — упрощён, убраны priorities + obligations):
 * 1. income_source_stability   — Select (optional)
 * 2. financial_stability_importance — NumberScale 1..5 (required)
 * 3. family_finance_management — Select (required)
 * 4. monthly_income_range      — Select (optional)
 * 5. housing_status            — Select (optional)
 *
 * API: /api/onboarding/profile/finance → profile_lifestyle.
 */
export function V2AnketaFinanceForm({
  locale,
  initial,
}: {
  locale: string;
  initial?: {
    income_source_stability?: string;
    financial_stability_importance?: number | null;
    family_finance_management?: string;
    monthly_income_range?: string;
    housing_status?: string;
  };
}) {
  const t = useTranslations("Anketa");
  const router = useRouter();
  const [incomeSource, setIncomeSource] = useState(
    initial?.income_source_stability ?? "",
  );
  const [importance, setImportance] = useState(
    initial?.financial_stability_importance != null
      ? String(initial.financial_stability_importance)
      : "",
  );
  const [management, setManagement] = useState(
    initial?.family_finance_management ?? "",
  );
  const [incomeRange, setIncomeRange] = useState(
    initial?.monthly_income_range ?? "",
  );
  const [housing, setHousing] = useState(initial?.housing_status ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);

  // §2 P0: эквивалент прежнего valid (importance 1-5 + management; прочее опц.).
  const importanceN = Number(importance);
  const errors: Record<string, string> = {};
  if (!(Number.isFinite(importanceN) && importanceN >= 1 && importanceN <= 5))
    errors.financial_stability_importance = t("err_select_required");
  if (!management) errors.family_finance_management = t("err_select_required");

  async function submit() {
    if (busy) return;
    if (Object.keys(errors).length) {
      setShowErrors(true);
      requestAnimationFrame(scrollToFirstError);
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/onboarding/profile/finance", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          // Доход опционален — отправляем только если выбран (пустую не шлём).
          ...(incomeSource ? { income_source_stability: incomeSource } : {}),
          financial_stability_importance: Number(importance),
          family_finance_management: management,
          ...(incomeRange ? { monthly_income_range: incomeRange } : {}),
          ...(housing ? { housing_status: housing } : {}),
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

  return (
    <div>
      <Field label={t("finance_income_source_question")} hint={t("optionalHint")}>
        <Select
          options={INCOME_SOURCE_STABILITY}
          value={incomeSource}
          onChange={setIncomeSource}
          locale={locale}
        />
      </Field>

      <Field
        label={t("finance_stability_importance_question")}
        required
        error={showErrors ? errors.financial_stability_importance : undefined}
      >
        <NumberScale
          min={1}
          max={5}
          value={importance}
          onChange={setImportance}
        />
      </Field>

      <Field
        label={t("finance_management_question")}
        required
        error={showErrors ? errors.family_finance_management : undefined}
      >
        <Select
          options={FAMILY_FINANCE_MANAGEMENT}
          value={management}
          onChange={setManagement}
          locale={locale}
        />
      </Field>

      <Field
        label={t("finance_income_range_question")}
        hint={t("optionalHint")}
      >
        <Select
          options={MONTHLY_INCOME_RANGE}
          value={incomeRange}
          onChange={setIncomeRange}
          locale={locale}
        />
      </Field>

      <Field label={t("finance_housing_question")} hint={t("optionalHint")}>
        <Select
          options={HOUSING_STATUS}
          value={housing}
          onChange={setHousing}
          locale={locale}
        />
      </Field>

      <p
        style={{
          margin: "4px 0 20px",
          padding: "10px 14px",
          fontSize: "12.5px",
          fontWeight: 600,
          lineHeight: 1.5,
          background: "var(--color-v2-chip-teal)",
          color: "var(--color-v2-chip-teal-ink)",
          borderRadius: "14px",
          fontFamily: "var(--font-v2-body)",
        }}
      >
        {t("finance_privacy_note")}
      </p>

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
          {t("err_failed")}
        </div>
      ) : null}

      <Button onClick={submit} disabled={busy} variant="primary">
        {busy ? t("btn_saving") : t("btn_next")}
      </Button>
    </div>
  );
}
