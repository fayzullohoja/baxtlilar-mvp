"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button } from "./Button";
import { Field, Select, Chips, NumberScale } from "./AnketaFields";
import {
  INCOME_SOURCE_STABILITY,
  FAMILY_FINANCE_MANAGEMENT,
  FINANCIAL_PRIORITIES,
  MONTHLY_INCOME_RANGE,
  FINANCIAL_OBLIGATIONS,
  HOUSING_STATUS,
} from "@/lib/profile/options";

/**
 * V4 (2026-06-30) — Чат 2 — Анкета.md Экран 9 «Финансы и материальная стабильность».
 *
 * Все 6 полей — cold (extended.finance). Экран hidden public по спеке;
 * per-block видимость регулируется на экране privacy (Экран 16).
 *
 * Блоки:
 * 1. income_source_stability   — Select (required)
 * 2. financial_stability_importance — NumberScale 1..5 (required)
 * 3. family_finance_management — Select (required)
 * 4. financial_priorities      — Chips multi-select, 1-3 (required)
 * 5. monthly_income_range      — Select (optional)
 * 6. financial_obligations     — Select (optional)
 *
 * API: /api/onboarding/profile/finance → profile_lifestyle.
 */
export function V2AnketaFinanceForm({ locale }: { locale: string }) {
  const t = useTranslations("Anketa");
  const router = useRouter();
  const [incomeSource, setIncomeSource] = useState("");
  const [importance, setImportance] = useState("");
  const [management, setManagement] = useState("");
  const [priorities, setPriorities] = useState<string[]>([]);
  const [incomeRange, setIncomeRange] = useState("");
  const [obligations, setObligations] = useState("");
  const [housing, setHousing] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function togglePriority(v: string) {
    setPriorities((cur) =>
      cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v],
    );
  }

  async function submit() {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/onboarding/profile/finance", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          income_source_stability: incomeSource,
          financial_stability_importance: Number(importance),
          family_finance_management: management,
          financial_priorities: priorities,
          ...(incomeRange ? { monthly_income_range: incomeRange } : {}),
          ...(obligations ? { financial_obligations: obligations } : {}),
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

  const importanceN = Number(importance);
  const valid =
    !!incomeSource &&
    Number.isFinite(importanceN) &&
    importanceN >= 1 &&
    importanceN <= 5 &&
    !!management &&
    priorities.length >= 1 &&
    priorities.length <= 3;

  return (
    <div>
      <Field label={t("finance_income_source_question")} required>
        <Select
          options={INCOME_SOURCE_STABILITY}
          value={incomeSource}
          onChange={setIncomeSource}
          locale={locale}
        />
      </Field>

      <Field label={t("finance_stability_importance_question")} required>
        <NumberScale
          min={1}
          max={5}
          value={importance}
          onChange={setImportance}
        />
      </Field>

      <Field label={t("finance_management_question")} required>
        <Select
          options={FAMILY_FINANCE_MANAGEMENT}
          value={management}
          onChange={setManagement}
          locale={locale}
        />
      </Field>

      <Field
        label={t("finance_priorities_question")}
        required
        hint={`${priorities.length}/3`}
      >
        <Chips
          options={FINANCIAL_PRIORITIES}
          selected={priorities}
          onToggle={togglePriority}
          max={3}
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

      <Field
        label={t("finance_obligations_question")}
        hint={t("optionalHint")}
      >
        <Select
          options={FINANCIAL_OBLIGATIONS}
          value={obligations}
          onChange={setObligations}
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

      <Button onClick={submit} disabled={busy || !valid} variant="primary">
        {busy ? t("btn_saving") : t("btn_next")}
      </Button>
    </div>
  );
}
