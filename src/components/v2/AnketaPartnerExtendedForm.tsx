"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button } from "./Button";
import { Field, TextInput, Chips } from "./AnketaFields";
import { PARTNER_QUALITIES } from "@/lib/profile/options";

/**
 * V3 Sprint 2 — Экран 8 «Ожидания от партнёра» (расширенный).
 *
 * Поля:
 * - partner_age_min/max (hot, required)
 * - partner_height_min/max (hot, optional)
 * - partner_top_qualities[] (hot, required, 1-5 из 14)
 *
 * partner_religion_preference уже спросили на Экране 6 (religion_partner_match).
 * partner_location_preference (cold) — TBD Sprint 3.
 *
 * API: /api/onboarding/profile/partner-extended.
 */
export function V2AnketaPartnerExtendedForm({ locale }: { locale: string }) {
  const t = useTranslations("Anketa");
  const router = useRouter();
  const [ageMin, setAgeMin] = useState("");
  const [ageMax, setAgeMax] = useState("");
  const [heightMin, setHeightMin] = useState("");
  const [heightMax, setHeightMax] = useState("");
  const [qualities, setQualities] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function toggleQ(v: string) {
    setQualities((cur) =>
      cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v],
    );
  }

  async function submit() {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      const body: Record<string, unknown> = {
        partner_age_min: Number(ageMin),
        partner_age_max: Number(ageMax),
        partner_top_qualities: qualities,
      };
      if (heightMin.trim() !== "") body.partner_height_min = Number(heightMin);
      if (heightMax.trim() !== "") body.partner_height_max = Number(heightMax);

      const res = await fetch("/api/onboarding/profile/partner-extended", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
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

  const ageOk =
    ageMin !== "" &&
    ageMax !== "" &&
    Number(ageMin) >= 18 &&
    Number(ageMax) >= 18 &&
    Number(ageMax) >= Number(ageMin);
  const heightOk =
    (heightMin.trim() === "" && heightMax.trim() === "") ||
    (heightMin !== "" &&
      heightMax !== "" &&
      Number(heightMin) >= 120 &&
      Number(heightMax) <= 230 &&
      Number(heightMax) >= Number(heightMin));
  const qOk = qualities.length >= 1 && qualities.length <= 5;
  const valid = ageOk && heightOk && qOk;

  return (
    <div>
      <Field label={t("partnerAgeLabel")} required hint="Диапазон, от 18 лет.">
        <div style={{ display: "flex", gap: 12 }}>
          <TextInput
            maxLength={3}
            value={ageMin}
            onChange={(e) => setAgeMin(e.target.value.replace(/\D/g, ""))}
            placeholder="от"
          />
          <TextInput
            maxLength={3}
            value={ageMax}
            onChange={(e) => setAgeMax(e.target.value.replace(/\D/g, ""))}
            placeholder="до"
          />
        </div>
      </Field>

      <Field
        label={t("partnerHeightLabel")}
        hint={t("partnerHeightHint")}
      >
        <div style={{ display: "flex", gap: 12 }}>
          <TextInput
            maxLength={3}
            value={heightMin}
            onChange={(e) => setHeightMin(e.target.value.replace(/\D/g, ""))}
            placeholder="от"
          />
          <TextInput
            maxLength={3}
            value={heightMax}
            onChange={(e) => setHeightMax(e.target.value.replace(/\D/g, ""))}
            placeholder="до"
          />
        </div>
      </Field>

      <Field
        label={t("partnerQualitiesLabel")}
        required
        hint={`Выбери от 1 до 5 — это ключ к подбору. Выбрано: ${qualities.length}/5`}
      >
        <Chips
          options={PARTNER_QUALITIES}
          selected={qualities}
          onToggle={toggleQ}
          max={5}
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
          {t("err_failed")}
        </div>
      ) : null}

      <Button onClick={submit} disabled={busy || !valid} variant="primary">
        {busy ? t("btn_saving") : t("btn_next")}
      </Button>
    </div>
  );
}
