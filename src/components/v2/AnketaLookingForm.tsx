"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "./Button";
import { AnketaSubmitNotice } from "./AnketaSubmitNotice";
import { useAnketaSubmit } from "./useAnketaSubmit";
import { Field, TextInput, Select } from "./AnketaFields";
import { GEO_PREFERENCE } from "@/lib/profile/options";

/**
 * V2 Anketa Looking-for (Blueprint §3.3 B4).
 *
 * Поля: partner_age_min, partner_age_max, geo_preference.
 * Гендер партнёра НЕ спрашиваем — в API выводится автоматически как
 * противоположный своему (см. looking-for route).
 *
 * API: /api/onboarding/profile/looking-for.
 */

export function V2AnketaLookingForm({ locale }: { locale: string }) {
  const { busy, errorCode, stepMoved, submit: submitStep } = useAnketaSubmit(
    "/api/onboarding/profile/looking-for",
  );
  const t = useTranslations("Anketa");
  // Локализованные ошибки из i18n — не хардкод RU ты-формы.
  const errCopy: Record<string, string> = {
    age_range_invalid: t("err_age_range_invalid"),
    validation: t("err_age_out_of_range"),
    failed: t("err_failed"),
  };
  const [min, setMin] = useState("");
  const [max, setMax] = useState("");
  const [geo, setGeo] = useState("");

  async function submit() {
    if (busy) return;
    await submitStep({
      partner_age_min: Number(min),
      partner_age_max: Number(max),
      geo_preference: geo,
    });
  }

  const minN = Number(min);
  const maxN = Number(max);
  const valid =
    !!geo &&
    minN >= 18 &&
    minN <= 100 &&
    maxN >= 18 &&
    maxN <= 100 &&
    maxN >= minN;

  return (
    <div>
      <Field label={t("partnerAgeLabel")} hint={t("partnerAgeHint")}>
        <div style={{ display: "flex", gap: "16px", alignItems: "flex-end" }}>
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontSize: "11px",
                color: "var(--color-v2-ink-400)",
                fontFamily: "var(--font-v2-body)",
                marginBottom: "4px",
              }}
            >
              {t("rangeFrom")}
            </div>
            <TextInput
              type="number"
              value={min}
              onChange={(e) => setMin(e.target.value)}
              placeholder="25"
            />
          </div>
          <div
            style={{
              padding: "0 0 16px 0",
              fontSize: "16px",
              color: "var(--color-v2-ink-400)",
              fontFamily: "var(--font-v2-body)",
            }}
          >
            —
          </div>
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontSize: "11px",
                color: "var(--color-v2-ink-400)",
                fontFamily: "var(--font-v2-body)",
                marginBottom: "4px",
              }}
            >
              {t("rangeTo")}
            </div>
            <TextInput
              type="number"
              value={max}
              onChange={(e) => setMax(e.target.value)}
              placeholder="35"
            />
          </div>
        </div>
      </Field>

      <Field label={t("geographyLabel")}>
        <Select options={GEO_PREFERENCE} value={geo} onChange={setGeo} locale={locale} />
      </Field>

      <AnketaSubmitNotice errorCode={errorCode} stepMoved={stepMoved} errorCopy={errCopy} />

      <Button onClick={submit} disabled={busy || !valid} variant="primary">
        {busy ? t("btn_saving") : t("btn_next")}
      </Button>
    </div>
  );
}
