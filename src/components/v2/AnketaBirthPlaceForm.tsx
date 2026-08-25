"use client";

import { useState } from "react";
import { Button } from "./Button";
import { AnketaSubmitNotice } from "./AnketaSubmitNotice";
import { useAnketaSubmit } from "./useAnketaSubmit";
import { Field, Select, TextInput, scrollToFirstError } from "./AnketaFields";
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
export function V2AnketaBirthPlaceForm({
  locale,
  initial,
  endpoint,
  submitLabel,
}: {
  locale: string;
  initial?: {
    birth_country?: string;
    birth_region?: string;
    birth_district?: string;
    birth_city?: string;
  };
  /** Куда слать. Пусто - обычный шаг анкеты. */
  endpoint?: string;
  /** Подпись кнопки. Пусто - «Далее», как в анкете. */
  submitLabel?: string;
}) {
  const t = useTranslations('Anketa');
  const { busy, errorCode, stepMoved, submit: submitStep } = useAnketaSubmit(endpoint ?? "/api/onboarding/profile/birth-place");
  const [country, setCountry] = useState(initial?.birth_country || "UZ");
  const [region, setRegion] = useState(initial?.birth_region ?? "");
  const [district, setDistrict] = useState(initial?.birth_district ?? "");
  const [city, setCity] = useState(initial?.birth_city ?? "");
  const [showErrors, setShowErrors] = useState(false);

  const showUzRegions = country === "UZ";
  // Район/город — дропдауны, если для выбранного региона есть справочник
  // (6 из 14 регионов); иначе freeform-ввод.
  const districtFromDict = showUzRegions && !!region && hasDistrictList(region);
  const cityFromDict = showUzRegions && !!region && hasCityList(region);

  // §2 P0: эквивалент прежнего гейта (страна всегда; регион — только для UZ,
  // где он Select; в non-UZ регион — freeform и опционален).
  const errors: Record<string, string> = {};
  if (!country) errors.birth_country = t("err_select_required");
  if (showUzRegions && !region) errors.birth_region = t("err_select_required");

  async function submit() {
    if (busy) return;
    if (Object.keys(errors).length) {
      setShowErrors(true);
      requestAnimationFrame(scrollToFirstError);
      return;
    }
    await submitStep({
      birth_country: country,
      birth_region: region.trim() || undefined,
      birth_district: district.trim() || undefined,
      birth_city: city.trim() || undefined,
    });
  }

  return (
    <div>
      <Field
        label={t('birth_place_country_label')}
        required
        hint={t('birth_place_country_hint')}
        error={showErrors ? errors.birth_country : undefined}
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
        <Field label={t('birth_place_region_label')} required error={showErrors ? errors.birth_region : undefined}>
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

      <AnketaSubmitNotice
        errorCode={errorCode}
        stepMoved={stepMoved}
        errorCopy={{ failed: t('birth_place_save_error') }}
      />

      <Button
        variant="primary"
        onClick={submit}
        disabled={busy}
        style={{ width: "100%" }}
      >
        {busy ? t('birth_place_saving') : (submitLabel ?? t("birth_place_next"))}
      </Button>
    </div>
  );
}
