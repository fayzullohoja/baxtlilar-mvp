"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "./Button";
import { Field, TextInput, Select } from "./AnketaFields";
import { useTranslations } from "next-intl";
import {
  GENDER,
  CITIZENSHIP,
  COUNTRY_OF_RESIDENCE,
  UZ_REGIONS,
} from "@/lib/profile/options";

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
}: {
  defaultName?: string;
  locale: string;
}) {
  const router = useRouter();
  const t = useTranslations("Anketa");
  const errCopy: Record<string, string> = {
    bio_has_contacts: t("err_bio_has_contacts"),
    name_has_contacts: t("err_name_has_contacts"),
    bio_too_short: t("err_bio_too_short"),
    bio_too_long: t("err_bio_too_long"),
    must_be_18: t("err_must_be_18"),
    invalid_age: t("err_invalid_age"),
    region_required_for_uz: t("err_region_required_for_uz"),
    validation: t("err_validation"),
    failed: t("err_failed"),
  };
  const [name, setName] = useState(defaultName ?? "");
  const [gender, setGender] = useState("");
  const [birth, setBirth] = useState("");
  // V2 ext 2026-06-28: гражданство + страна проживания + регион.
  const [citizenship, setCitizenship] = useState("");
  const [country, setCountry] = useState("");
  const [region, setRegion] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Region виден только если выбрано проживание в UZ.
  const showRegion = country === "UZ";

  async function submit() {
    if (busy) return;
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

  const valid =
    name.trim().length >= 2 &&
    !!gender &&
    !!birth &&
    !!citizenship &&
    !!country &&
    (!showRegion || !!region);

  return (
    <div>
      <Field label={t("name_label")}>
        <TextInput
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={50}
          placeholder={t("name_placeholder")}
        />
      </Field>
      <Field label={t("gender_label")}>
        <Select options={GENDER} value={gender} onChange={setGender} locale={locale} />
      </Field>
      <Field label={t("birth_label")}>
        <TextInput type="date" value={birth} onChange={(e) => setBirth(e.target.value)} />
      </Field>
      <Field
        label={t("citizenship_label")}
        hint={t("citizenship_hint")}
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
      >
        <Select
          options={COUNTRY_OF_RESIDENCE}
          value={country}
          onChange={(v) => {
            setCountry(v);
            if (v !== "UZ") setRegion("");
          }}
          locale={locale}
        />
      </Field>
      {showRegion ? (
        <Field
          label={t("region_label")}
          hint={t("region_hint")}
        >
          <Select
            options={UZ_REGIONS}
            value={region}
            onChange={setRegion}
            locale={locale}
          />
        </Field>
      ) : null}

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
            lineHeight: "1.5",
          }}
        >
          {errCopy[err] ?? errCopy.failed}
        </div>
      ) : null}

      <Button onClick={submit} disabled={busy || !valid} variant="primary">
        {busy ? t("btn_saving") : t("btn_next")}
      </Button>
    </div>
  );
}
