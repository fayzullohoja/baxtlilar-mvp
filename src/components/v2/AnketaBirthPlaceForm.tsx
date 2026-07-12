"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "./Button";
import { Field, Select, TextInput } from "./AnketaFields";
import { COUNTRY_OF_RESIDENCE, UZ_REGIONS } from "@/lib/profile/options";
import { UZ_DISTRICTS_BY_REGION, hasDistrictList } from "@/lib/profile/uz-districts";
import { citiesForRegion, hasCityList } from "@/lib/profile/cities";
import { useTranslations } from 'next-intl';

/**
 * V3 Sprint 1 — Экран 2 «Место рождения / родной регион».
 * 4 поля: страна (required), регион / район / город (опц).
 * Для UZ — Select из UZ_REGIONS; район/город — зависимые дропдауны от региона
 * (где есть справочник), иначе freeform. Для остальных стран — freeform.
 * API: /api/onboarding/profile/birth-place.
 */
export function V2AnketaBirthPlaceForm({ locale }: { locale: string }) {
  const t = useTranslations('Anketa');
  const router = useRouter();
  const [country, setCountry] = useState("UZ");
  const [region, setRegion] = useState("");
  const [district, setDistrict] = useState("");
  const [city, setCity] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const showUzRegions = country === "UZ";
  // Район/город — дропдауны, если для выбранного региона есть справочник
  // (6 из 14 регионов); иначе freeform-ввод.
  const districtFromDict = showUzRegions && !!region && hasDistrictList(region);
  const cityFromDict = showUzRegions && !!region && hasCityList(region);

  async function submit() {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/onboarding/profile/birth-place", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          birth_country: country,
          birth_region: region.trim() || undefined,
          birth_district: district.trim() || undefined,
          birth_city: city.trim() || undefined,
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
      <Field
        label={t('birth_place_country_label')}
        required
        hint={t('birth_place_country_hint')}
      >
        <Select
          options={COUNTRY_OF_RESIDENCE}
          value={country}
          onChange={(v) => {
            setCountry(v);
            // Регион меняет тип (UZ → Select из UZ_REGIONS, иначе freeform),
            // поэтому сбрасываем при ЛЮБОЙ смене страны — иначе freeform-строка
            // (напр. «Almaty») утечёт в UZ-Select и уйдёт на сервер как невалидный
            // birth_region для birth_country=UZ. Район/город тоже зависят от региона.
            setRegion("");
            setDistrict("");
            setCity("");
          }}
          locale={locale}
        />
      </Field>

      {showUzRegions ? (
        <Field label={t('birth_place_region_label')} required>
          <Select
            options={UZ_REGIONS}
            value={region}
            onChange={(v) => {
              // Смена региона обнуляет зависимые район/город.
              setRegion(v);
              setDistrict("");
              setCity("");
            }}
            locale={locale}
          />
        </Field>
      ) : (
        <Field
          label={t('birth_place_region_label')}
          hint={t('birth_place_region_hint_optional')}
        >
          <TextInput
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            maxLength={128}
          />
        </Field>
      )}

      <Field
        label={t('birth_place_district_label')}
        hint={t('birth_place_district_hint')}
      >
        {districtFromDict ? (
          <Select
            options={UZ_DISTRICTS_BY_REGION[region]}
            value={district}
            onChange={setDistrict}
            locale={locale}
          />
        ) : (
          <TextInput
            value={district}
            onChange={(e) => setDistrict(e.target.value)}
            maxLength={128}
          />
        )}
      </Field>

      <Field
        label={t('birth_place_city_label')}
        hint={t('birth_place_city_hint')}
      >
        {cityFromDict ? (
          <Select
            options={citiesForRegion(region)}
            value={city}
            onChange={setCity}
            locale={locale}
          />
        ) : (
          <TextInput
            value={city}
            onChange={(e) => setCity(e.target.value)}
            maxLength={128}
          />
        )}
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
            marginBottom: "24px",
          }}
        >
          {t('birth_place_save_error')}
        </div>
      ) : null}

      <Button
        variant="primary"
        onClick={submit}
        disabled={!country || (showUzRegions && !region) || busy}
        style={{ width: "100%" }}
      >
        {busy ? t('birth_place_saving') : t('birth_place_next')}
      </Button>
    </div>
  );
}
