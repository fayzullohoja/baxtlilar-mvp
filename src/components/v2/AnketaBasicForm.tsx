"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "./Button";
import { Field, TextInput, Select, scrollToFirstError } from "./AnketaFields";
import { useTranslations } from "next-intl";
import {
  GENDER,
  CITIZENSHIP,
  COUNTRY_OF_RESIDENCE,
  UZ_REGIONS,
  UZ_DISTRICTS_BY_REGION,
  hasDistrictList,
} from "@/lib/profile/options";
import { useOptLabel } from "./useOptLabel";

/**
 * V2 Anketa Basic form (Blueprint §3.3 B1).
 * Поля: имя, пол, дата рождения, гражданство, страна проживания, регион (UZ),
 * город, bio.
 * API: /api/onboarding/profile/basic.
 *
 * V2 ext 2026-06-28: добавлены citizenship + country_of_residence + region.
 * Гражданство и страна проживания могут не совпадать (UZ-гражданин в РФ).
 * При approve паспорта в админке citizenship сверяется с user_identity.
 */



export function V2AnketaBasicForm({
  defaultName,
  locale,
  verifiedGender,
  verifiedLegalName,
}: {
  defaultName?: string;
  locale: string;
  // Ревью оунера: пол/ФИО из верифицированного user_identity (модератор ввёл из
  // документа). Пол блокируем на это значение; ФИО показываем read-only.
  verifiedGender?: string | null;
  verifiedLegalName?: string | null;
}) {
  const router = useRouter();
  const t = useTranslations("Anketa");
  // Tier 2: редактируемые лейблы вариантов (fallback → options.ts)
  const { labelOf: optLabelOf } = useOptLabel(locale);
  const errCopy: Record<string, string> = {
    bio_has_contacts: t("err_bio_has_contacts"),
    name_has_contacts: t("err_name_has_contacts"),
    bio_too_short: t("err_bio_too_short"),
    bio_too_long: t("err_bio_too_long"),
    must_be_18: t("err_must_be_18"),
    invalid_age: t("err_invalid_age"),
    region_required_for_uz: t("err_region_required_for_uz"),
    gender_locked: t("genderVerifiedNote"),
    validation: t("err_validation"),
    failed: t("err_failed"),
  };
  const [name, setName] = useState(defaultName ?? "");
  // Пол заблокирован на верифицированное значение (если оно есть) — иначе
  // редактируемый Select.
  const genderLocked = verifiedGender === "m" || verifiedGender === "f";
  const [gender, setGender] = useState(genderLocked ? verifiedGender! : "");
  const [birth, setBirth] = useState("");
  // V2 ext 2026-06-28: гражданство + страна проживания + регион.
  const [citizenship, setCitizenship] = useState("");
  const [country, setCountry] = useState("");
  const [region, setRegion] = useState("");
  // V4 2026-06-30 (Чат 2 — Анкета, Экран 2): район проживания + флаг публичной
  // видимости. Показывается каскадом после выбора региона; если для региона
  // есть курируемый список (UZ_DISTRICTS_BY_REGION) — Select, иначе freeform.
  // По умолчанию район скрыт (учредительская приватность «минимум инфо до match»).
  const [district, setDistrict] = useState("");
  const [districtVisiblePublic, setDistrictVisiblePublic] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);

  // Region виден только если выбрано проживание в UZ.
  const showRegion = country === "UZ";
  // District виден только когда есть выбранный регион (UZ + region).
  const showDistrict = showRegion && !!region;
  const districtFromDict = showDistrict && hasDistrictList(region);

  // §2 P0: эквивалент прежнего valid (имя ≥2, пол, дата, гражданство, страна,
  // регион для UZ). Пол при genderLocked уже задан — ошибки не будет.
  const errors: Record<string, string> = {};
  if (name.trim().length < 2) errors.display_name = t("err_field_required");
  if (!gender) errors.gender = t("err_select_required");
  if (!birth) errors.birth_date = t("err_field_required");
  if (!citizenship) errors.citizenship = t("err_select_required");
  if (!country) errors.country_of_residence = t("err_select_required");
  if (showRegion && !region) errors.region = t("err_select_required");

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
      const res = await fetch("/api/onboarding/profile/basic", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          display_name: name,
          gender,
          birth_date: birth,
          citizenship,
          country_of_residence: country,
          ...(showRegion ? { region } : {}),
          // district — nullable, отправляем только если реально введено.
          // Флаг видимости шлём только когда district block фактически показан,
          // иначе оставшийся в стейте true с прошлого UZ-выбора протек бы в БД
          // при смене country_of_residence на не-UZ (baxt fix P5).
          ...(showDistrict && district.trim() ? { district: district.trim() } : {}),
          ...(showDistrict ? { district_visible_public: districtVisiblePublic } : {}),
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

  return (
    <div>
      {/* Ревью оунера (name-split): ФИО по документу — read-only приватный
          контекст, чтобы юзер понимал разницу между юр-именем и публичным. */}
      {verifiedLegalName ? (
        <div
          style={{
            marginBottom: "16px",
            padding: "10px 14px",
            background: "var(--color-v2-chip-teal)",
            borderRadius: "12px",
            fontFamily: "var(--font-v2-body)",
          }}
        >
          <div
            style={{
              fontSize: "11px",
              fontWeight: 700,
              color: "var(--color-v2-chip-teal-ink)",
              opacity: 0.75,
              marginBottom: "2px",
            }}
          >
            {t("legalNameVerifiedLabel")}
          </div>
          <div
            style={{
              fontSize: "14px",
              fontWeight: 600,
              color: "var(--color-v2-chip-teal-ink)",
            }}
          >
            {verifiedLegalName}
          </div>
        </div>
      ) : null}

      <Field label={t("name_label")} hint={t("displayNamePublicHint")} error={showErrors ? errors.display_name : undefined}>
        <TextInput
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={50}
          placeholder={t("name_placeholder")}
        />
      </Field>
      {genderLocked ? (
        <Field label={t("gender_label")} hint={t("genderVerifiedNote")}>
          <div
            style={{
              padding: "12px 14px",
              background: "var(--color-v2-ink-600, #f4f3ef)",
              border: "1px solid var(--color-v2-border)",
              borderRadius: "12px",
              fontFamily: "var(--font-v2-body)",
              fontSize: "15px",
              color: "var(--color-v2-ink-300)",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <span aria-hidden>🔒</span>
            {optLabelOf(GENDER, gender)}
          </div>
        </Field>
      ) : (
        <Field label={t("gender_label")} error={showErrors ? errors.gender : undefined}>
          <Select options={GENDER} value={gender} onChange={setGender} locale={locale} />
        </Field>
      )}
      <Field label={t("birth_label")} error={showErrors ? errors.birth_date : undefined}>
        <TextInput type="date" value={birth} onChange={(e) => setBirth(e.target.value)} />
      </Field>
      <Field
        label={t("citizenship_label")}
        hint={t("citizenship_hint")}
        error={showErrors ? errors.citizenship : undefined}
      >
        <Select
          options={CITIZENSHIP}
          value={citizenship}
          onChange={setCitizenship}
          locale={locale}
        />
      </Field>
      <Field
        label={t("residence_label")}
        hint={t("residence_hint")}
        error={showErrors ? errors.country_of_residence : undefined}
      >
        <Select
          options={COUNTRY_OF_RESIDENCE}
          value={country}
          onChange={(v) => {
            setCountry(v);
            if (v !== "UZ") {
              setRegion("");
              setDistrict("");
              setDistrictVisiblePublic(false);
            }
          }}
          locale={locale}
        />
      </Field>
      {showRegion ? (
        <Field
          label={t("region_label")}
          hint={t("region_hint")}
          error={showErrors ? errors.region : undefined}
        >
          <Select
            options={UZ_REGIONS}
            value={region}
            onChange={(v) => {
              setRegion(v);
              // При смене региона сбрасываем район — старое значение из другого
              // списка не должно висеть.
              setDistrict("");
            }}
            locale={locale}
          />
        </Field>
      ) : null}

      {showDistrict ? (
        <Field
          label={t("basic_district_label")}
          hint={t("basic_district_hint")}
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
              placeholder={t("basic_district_freeform_placeholder")}
            />
          )}
        </Field>
      ) : null}

      {showDistrict ? (
        <label
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: "10px",
            marginBottom: "32px",
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={districtVisiblePublic}
            onChange={(e) => setDistrictVisiblePublic(e.target.checked)}
            style={{
              marginTop: "4px",
              width: "16px",
              height: "16px",
              accentColor: "var(--color-v2-accent)",
            }}
          />
          <span
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "4px",
              fontFamily: "var(--font-v2-body)",
            }}
          >
            <span
              style={{
                fontSize: "13px",
                color: "var(--color-v2-ink-200)",
                lineHeight: "1.5",
              }}
            >
              {t("basic_district_visible_label")}
            </span>
            <span
              style={{
                fontSize: "12px",
                color: "var(--color-v2-ink-400)",
                lineHeight: "1.45",
              }}
            >
              {t("basic_district_visible_hint")}
            </span>
          </span>
        </label>
      ) : null}

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
            lineHeight: "1.5",
          }}
        >
          {errCopy[err] ?? errCopy.failed}
        </div>
      ) : null}

      <Button onClick={submit} disabled={busy} variant="primary">
        {busy ? t("btn_saving") : t("btn_next")}
      </Button>
    </div>
  );
}
