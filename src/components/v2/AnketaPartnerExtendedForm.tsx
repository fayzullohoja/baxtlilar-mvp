"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button } from "./Button";
import { Field, TextInput, Chips, Select } from "./AnketaFields";
import {
  PARTNER_QUALITIES,
  RELIGION_PARTNER_MATCH,
  PARTNER_PREFERRED_COUNTRIES,
  PARTNER_ANY_COUNTRY,
  PARTNER_MARITAL_PREF,
  PARTNER_CHILDREN_PREF,
  PARTNER_ORIGIN_REGION_PREF,
  PARTNER_HARD_CRITERIA,
} from "@/lib/profile/options";

/**
 * V3 Sprint 2 — Экран 8 «Ожидания от партнёра» (расширенный).
 *
 * Поля:
 * - partner_age_min/max (hot, required)
 * - partner_height_min/max (hot, optional)
 * - partner_top_qualities[] (hot, required, 1-5 из 14)
 * - partner_religion_match (hot, optional) — миграция per founder #10 (section purity),
 *   ранее спрашивалось в AnketaValuesForm.
 * - partner_preferred_countries[] (hot, optional, soft filter, max 3) — founder #13.
 *
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
  const [religionMatch, setReligionMatch] = useState("");
  const [countries, setCountries] = useState<string[]>([]);
  const [maritalPref, setMaritalPref] = useState<string[]>([]);
  const [childrenPref, setChildrenPref] = useState("");
  const [regionPref, setRegionPref] = useState("");
  const [hardCriteria, setHardCriteria] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function toggleQ(v: string) {
    setQualities((cur) =>
      cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v],
    );
  }

  function toggleMarital(v: string) {
    // «Не имеет значения» (any) взаимоисключающий.
    setMaritalPref((cur) => {
      if (v === "any") return cur.includes(v) ? [] : ["any"];
      if (cur.includes(v)) return cur.filter((x) => x !== v);
      return [...cur.filter((x) => x !== "any"), v];
    });
  }

  function toggleHard(v: string) {
    setHardCriteria((cur) =>
      cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v],
    );
  }

  function toggleCountry(v: string) {
    setCountries((cur) => {
      // «Не имеет значения» взаимоисключающий: сбрасывает остальные страны и наоборот.
      if (v === PARTNER_ANY_COUNTRY) return cur.includes(v) ? [] : [PARTNER_ANY_COUNTRY];
      if (cur.includes(v)) return cur.filter((x) => x !== v);
      return [...cur.filter((x) => x !== PARTNER_ANY_COUNTRY), v];
    });
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
      if (religionMatch !== "") body.partner_religion_match = religionMatch;
      if (countries.length > 0) body.partner_preferred_countries = countries;
      if (maritalPref.length > 0) body.partner_marital_pref = maritalPref;
      if (childrenPref !== "") body.partner_children_pref = childrenPref;
      if (regionPref !== "") body.partner_origin_region_pref = regionPref;
      if (hardCriteria.length > 0) body.partner_hard_criteria = hardCriteria;

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
      Number(heightMin) >= 140 &&
      Number(heightMax) <= 220 &&
      Number(heightMax) >= Number(heightMin));
  const qOk = qualities.length >= 1 && qualities.length <= 5;
  const countriesOk = countries.length <= 3;
  const valid = ageOk && heightOk && qOk && countriesOk;

  return (
    <div>
      <Field label={t("partnerAgeLabel")} required hint={t("partnerAgeHint")}>
        <div style={{ display: "flex", gap: 12 }}>
          <TextInput
            maxLength={3}
            value={ageMin}
            onChange={(e) => setAgeMin(e.target.value.replace(/\D/g, ""))}
            placeholder={t("partnerAgeFrom")}
          />
          <TextInput
            maxLength={3}
            value={ageMax}
            onChange={(e) => setAgeMax(e.target.value.replace(/\D/g, ""))}
            placeholder={t("partnerAgeTo")}
          />
        </div>
        {ageMin !== "" &&
        ageMax !== "" &&
        Number(ageMax) >= Number(ageMin) &&
        Number(ageMax) - Number(ageMin) < 3 ? (
          <div
            style={{
              marginTop: 8,
              fontSize: "12.5px",
              lineHeight: 1.45,
              color: "var(--color-v2-ink-400)",
              fontFamily: "var(--font-v2-body)",
            }}
          >
            {t("partner_age_narrow_warning")}
          </div>
        ) : null}
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
            placeholder={t("partnerAgeFrom")}
          />
          <TextInput
            maxLength={3}
            value={heightMax}
            onChange={(e) => setHeightMax(e.target.value.replace(/\D/g, ""))}
            placeholder={t("partnerAgeTo")}
          />
        </div>
      </Field>

      <Field
        label={t("partnerQualitiesLabel")}
        required
        hint={t("partner_qualities_hint", { count: qualities.length })}
      >
        <Chips
          options={PARTNER_QUALITIES}
          selected={qualities}
          onToggle={toggleQ}
          max={5}
          locale={locale}
        />
      </Field>

      <Field
        label={t("religion_partner_match_question")}
        hint={t("religion_partner_match_hint")}
      >
        <Select
          options={RELIGION_PARTNER_MATCH}
          value={religionMatch}
          onChange={setReligionMatch}
          locale={locale}
          placeholder="—"
        />
      </Field>

      <Field
        label={t("partner_preferred_countries_question")}
        hint={t("partner_preferred_countries_hint")}
      >
        <Chips
          options={PARTNER_PREFERRED_COUNTRIES}
          selected={countries}
          onToggle={toggleCountry}
          max={3}
          locale={locale}
        />
      </Field>

      <Field label={t("partner_marital_pref_question")} hint={t("optionalHint")}>
        <Chips
          options={PARTNER_MARITAL_PREF}
          selected={maritalPref}
          onToggle={toggleMarital}
          max={5}
          locale={locale}
        />
      </Field>

      <Field label={t("partner_children_pref_question")} hint={t("optionalHint")}>
        <Select
          options={PARTNER_CHILDREN_PREF}
          value={childrenPref}
          onChange={setChildrenPref}
          locale={locale}
        />
      </Field>

      <Field label={t("partner_origin_region_pref_question")} hint={t("optionalHint")}>
        <Select
          options={PARTNER_ORIGIN_REGION_PREF}
          value={regionPref}
          onChange={setRegionPref}
          locale={locale}
        />
      </Field>

      <Field
        label={t("partner_hard_criteria_question")}
        hint={t("partner_hard_criteria_hint")}
      >
        <Chips
          options={PARTNER_HARD_CRITERIA}
          selected={hardCriteria}
          onToggle={toggleHard}
          max={6}
          locale={locale}
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
          {t("err_failed")}
        </div>
      ) : null}

      <Button onClick={submit} disabled={busy || !valid} variant="primary">
        {busy ? t("btn_saving") : t("btn_next")}
      </Button>
    </div>
  );
}
