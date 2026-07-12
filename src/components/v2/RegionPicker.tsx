"use client";

import { Field, Select, TextInput } from "./AnketaFields";
import { COUNTRY_OF_RESIDENCE, UZ_REGIONS } from "@/lib/profile/options";
import { citiesForRegion, hasCityList } from "@/lib/profile/cities";

export type RegionValue = { country: string; region: string; city: string };

/**
 * Переиспользуемый каскад страна → регион → город (Экран 6 «Родители», 4 инстанса).
 * UZ → Select из UZ_REGIONS + город-дропдаун (где есть справочник) / freeform;
 * прочие страны — freeform region/city. Всё опционально (можно пропустить).
 *
 * ВАЖНО (баг-фикс из birth-place): смена страны сбрасывает region+city, иначе
 * freeform-строка (напр. «Almaty») утечёт в UZ-Select как невалидный код региона.
 */
export function RegionPicker({
  locale,
  value,
  onChange,
  labels,
}: {
  locale: string;
  value: RegionValue;
  onChange: (v: RegionValue) => void;
  labels: {
    country: string;
    region: string;
    city: string;
    countryHint?: string;
    regionHint?: string;
    cityHint?: string;
  };
}) {
  const isUz = value.country === "UZ";
  const cityFromDict = isUz && !!value.region && hasCityList(value.region);

  return (
    <div>
      <Field label={labels.country} hint={labels.countryHint}>
        <Select
          options={COUNTRY_OF_RESIDENCE}
          value={value.country}
          onChange={(country) => onChange({ country, region: "", city: "" })}
          locale={locale}
        />
      </Field>

      {value.country ? (
        <>
          {isUz ? (
            <Field label={labels.region} hint={labels.regionHint}>
              <Select
                options={UZ_REGIONS}
                value={value.region}
                onChange={(region) => onChange({ ...value, region, city: "" })}
                locale={locale}
              />
            </Field>
          ) : (
            <Field label={labels.region} hint={labels.regionHint}>
              <TextInput
                value={value.region}
                onChange={(e) => onChange({ ...value, region: e.target.value })}
                maxLength={128}
              />
            </Field>
          )}

          <Field label={labels.city} hint={labels.cityHint}>
            {cityFromDict ? (
              <Select
                options={citiesForRegion(value.region)}
                value={value.city}
                onChange={(city) => onChange({ ...value, city })}
                locale={locale}
              />
            ) : (
              <TextInput
                value={value.city}
                onChange={(e) => onChange({ ...value, city: e.target.value })}
                maxLength={128}
              />
            )}
          </Field>
        </>
      ) : null}
    </div>
  );
}
