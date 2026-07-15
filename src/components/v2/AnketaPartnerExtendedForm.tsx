"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button } from "./Button";
import { Field, Chips, Select, DualRangeSlider } from "./AnketaFields";
import {
  PARTNER_QUALITIES,
  RELIGION_PARTNER_MATCH,
  PARTNER_PREFERRED_COUNTRIES,
  PARTNER_ANY_COUNTRY,
  PARTNER_MARITAL_PREF,
  PARTNER_CHILDREN_PREF,
  PARTNER_ORIGIN_REGION_PREF,
  PARTNER_NATIONALITY_PREF,
  PARTNER_NATIONALITY,
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
 * 2026-07-12 (ревью оунера): возраст/рост — двойные ползунки-диапазоны.
 * API: /api/onboarding/profile/partner-extended.
 */

const AGE_MIN = 18;
const AGE_MAX = 80;
const AGE_DEF_LO = 25;
const AGE_DEF_HI = 35;
const HEIGHT_MIN = 140;
const HEIGHT_MAX = 220;
const HEIGHT_DEF_LO = 160;
const HEIGHT_DEF_HI = 185;
const WEIGHT_MIN = 35;
const WEIGHT_MAX = 200;
const WEIGHT_DEF_LO = 55;
const WEIGHT_DEF_HI = 90;

function parseRange(
  minStr: string | undefined,
  maxStr: string | undefined,
  defLo: number,
  defHi: number,
): { lo: number; hi: number; set: boolean } {
  const hasMin = minStr != null && minStr !== "";
  const hasMax = maxStr != null && maxStr !== "";
  return {
    lo: hasMin ? Number(minStr) : defLo,
    hi: hasMax ? Number(maxStr) : defHi,
    set: hasMin && hasMax,
  };
}

export function V2AnketaPartnerExtendedForm({
  locale,
  initial,
}: {
  locale: string;
  initial?: {
    partner_age_min?: string;
    partner_age_max?: string;
    partner_height_min?: string;
    partner_height_max?: string;
    partner_weight_min?: string;
    partner_weight_max?: string;
    partner_nationality_pref?: string;
    partner_nationality?: string[];
    partner_top_qualities?: string[];
    partner_religion_match?: string;
    partner_preferred_countries?: string[];
    partner_marital_pref?: string[];
    partner_children_pref?: string;
    partner_hard_criteria?: string[];
    partner_origin_region_pref?: string;
  };
}) {
  const t = useTranslations("Anketa");
  const router = useRouter();
  // Возраст/рост — диапазоны двойным ползунком. «Не указано» до касания (isSet).
  const initAge = parseRange(
    initial?.partner_age_min,
    initial?.partner_age_max,
    AGE_DEF_LO,
    AGE_DEF_HI,
  );
  const initHeight = parseRange(
    initial?.partner_height_min,
    initial?.partner_height_max,
    HEIGHT_DEF_LO,
    HEIGHT_DEF_HI,
  );
  const [ageLo, setAgeLo] = useState(initAge.lo);
  const [ageHi, setAgeHi] = useState(initAge.hi);
  const [ageSet, setAgeSet] = useState(initAge.set);
  const [heightLo, setHeightLo] = useState(initHeight.lo);
  const [heightHi, setHeightHi] = useState(initHeight.hi);
  const [heightSet, setHeightSet] = useState(initHeight.set);
  const initWeight = parseRange(
    initial?.partner_weight_min,
    initial?.partner_weight_max,
    WEIGHT_DEF_LO,
    WEIGHT_DEF_HI,
  );
  const [weightLo, setWeightLo] = useState(initWeight.lo);
  const [weightHi, setWeightHi] = useState(initWeight.hi);
  const [weightSet, setWeightSet] = useState(initWeight.set);
  const [nationalityPref, setNationalityPref] = useState(
    initial?.partner_nationality_pref ?? "",
  );
  const [nationality, setNationality] = useState<string[]>(
    initial?.partner_nationality ?? [],
  );
  const [qualities, setQualities] = useState<string[]>(
    initial?.partner_top_qualities ?? [],
  );
  const [religionMatch, setReligionMatch] = useState(
    initial?.partner_religion_match ?? "",
  );
  const [countries, setCountries] = useState<string[]>(
    initial?.partner_preferred_countries ?? [],
  );
  const [maritalPref, setMaritalPref] = useState<string[]>(
    initial?.partner_marital_pref ?? [],
  );
  const [childrenPref, setChildrenPref] = useState(
    initial?.partner_children_pref ?? "",
  );
  const [regionPref, setRegionPref] = useState(
    initial?.partner_origin_region_pref ?? "",
  );
  const [hardCriteria, setHardCriteria] = useState<string[]>(
    initial?.partner_hard_criteria ?? [],
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function toggleQ(v: string) {
    setQualities((cur) =>
      cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v],
    );
  }

  function toggleNationality(v: string) {
    setNationality((cur) =>
      cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v],
    );
  }

  // Смена предпочтения: список конкретных национальностей нужен только при "specific",
  // иначе чистим — иначе персистился бы «any» со стейл-списком.
  function changeNationalityPref(v: string) {
    setNationalityPref(v);
    if (v !== "specific") setNationality([]);
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
        partner_age_min: ageLo,
        partner_age_max: ageHi,
        partner_top_qualities: qualities,
      };
      if (heightSet) {
        body.partner_height_min = heightLo;
        body.partner_height_max = heightHi;
      }
      if (weightSet) {
        body.partner_weight_min = weightLo;
        body.partner_weight_max = weightHi;
      }
      if (nationalityPref !== "") body.partner_nationality_pref = nationalityPref;
      if (nationalityPref === "specific" && nationality.length > 0)
        body.partner_nationality = nationality;
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

  // Возраст обязателен (нужно задать диапазон); рост опционален. Ползунок сам
  // гарантирует lo<=hi и границы, так что валидность — просто «задан ли возраст».
  const ageOk = ageSet;
  const qOk = qualities.length >= 1 && qualities.length <= 5;
  const countriesOk = countries.length <= 3;
  // «Выбрать конкретно» требует ≥1 национальности (совпадает с refine схемы).
  const nationalityOk = nationalityPref !== "specific" || nationality.length >= 1;
  const valid = ageOk && qOk && countriesOk && nationalityOk;

  return (
    <div>
      <Field label={t("partnerAgeLabel")} required hint={t("partnerAgeHint")}>
        <DualRangeSlider
          min={AGE_MIN}
          max={AGE_MAX}
          minValue={ageLo}
          maxValue={ageHi}
          isSet={ageSet}
          onChange={(lo, hi, set) => {
            setAgeLo(lo);
            setAgeHi(hi);
            setAgeSet(set);
          }}
          unit={t("childAgeUnit")}
          notSetLabel={t("partnerAgePrompt")}
          clearLabel={t("clearValue")}
          clearable={false}
        />
        {ageSet && ageHi - ageLo < 3 ? (
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

      <Field label={t("partnerHeightLabel")} hint={t("partnerHeightHint")}>
        <DualRangeSlider
          min={HEIGHT_MIN}
          max={HEIGHT_MAX}
          minValue={heightLo}
          maxValue={heightHi}
          isSet={heightSet}
          onChange={(lo, hi, set) => {
            setHeightLo(lo);
            setHeightHi(hi);
            setHeightSet(set);
          }}
          unit={t("unitCm")}
          notSetLabel={t("notSpecified")}
          clearLabel={t("clearValue")}
        />
      </Field>

      {/* 1.13: вес партнёра — optional, soft (не главный критерий подбора). */}
      <Field label={t("partnerWeightLabel")} hint={t("partnerWeightHint")}>
        <DualRangeSlider
          min={WEIGHT_MIN}
          max={WEIGHT_MAX}
          minValue={weightLo}
          maxValue={weightHi}
          isSet={weightSet}
          onChange={(lo, hi, set) => {
            setWeightLo(lo);
            setWeightHi(hi);
            setWeightSet(set);
          }}
          unit={t("unitKg")}
          notSetLabel={t("notSpecified")}
          clearLabel={t("clearValue")}
        />
      </Field>

      {/* 1.14: национальность партнёра — предпочтение + (при «выбрать конкретно») список. */}
      <Field label={t("partnerNationalityLabel")} hint={t("optionalHint")}>
        <Select
          options={PARTNER_NATIONALITY_PREF}
          value={nationalityPref}
          onChange={changeNationalityPref}
          locale={locale}
        />
      </Field>
      {nationalityPref === "specific" ? (
        <Field label={t("partnerNationalityListLabel")} required hint={t("partnerNationalityListHint")}>
          <Chips
            options={PARTNER_NATIONALITY}
            selected={nationality}
            onToggle={toggleNationality}
            locale={locale}
          />
        </Field>
      ) : null}

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

      <Field label={t("partner_origin_region_pref_question")} hint={t("optionalHint")}>
        <Select
          options={PARTNER_ORIGIN_REGION_PREF}
          value={regionPref}
          onChange={setRegionPref}
          locale={locale}
        />
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
