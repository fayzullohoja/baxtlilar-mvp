"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { Button } from "./Button";
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

const ERR_COPY: Record<string, string> = {
  age_range_invalid: "Максимум должен быть больше или равен минимуму.",
  validation: "Проверь возраст — от 18 до 100.",
  failed: "Не получилось сохранить. Попробуй ещё раз.",
};

export function V2AnketaLookingForm({ locale }: { locale: string }) {
  const router = useRouter();
  const t = useTranslations("Anketa");
  const [min, setMin] = useState("");
  const [max, setMax] = useState("");
  const [geo, setGeo] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/onboarding/profile/looking-for", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          partner_age_min: Number(min),
          partner_age_max: Number(max),
          geo_preference: geo,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok: boolean;
        next?: string;
        detail?: string;
        error?: string;
      };
      if (data.ok && data.next) {
        router.replace(data.next);
        return;
      }
      setErr(data.detail ?? data.error ?? "failed");
    } catch {
      setErr("failed");
    } finally {
      setBusy(false);
    }
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
      <Field
        label={t("partnerAgeLabel")}
        hint="От и до — фильтр алгоритма. Не строгая граница, просто чтобы не показывать совсем мимо."
      >
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
              От
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
              До
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
          {ERR_COPY[err] ?? ERR_COPY.failed}
        </div>
      ) : null}

      <Button onClick={submit} disabled={busy || !valid} variant="primary">
        {busy ? t("btn_saving") : t("btn_next")}
      </Button>
    </div>
  );
}
