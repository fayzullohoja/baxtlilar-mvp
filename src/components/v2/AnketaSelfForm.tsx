"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button } from "./Button";
import { Field, Select, TextArea, TextInput, scrollToFirstError } from "./AnketaFields";
import {
  EMPLOYMENT_STATUS,
  EMPLOYMENT_WORKING_STATUSES,
  EDUCATION,
  ACTIVITY_FIELDS,
  EMPLOYMENT_FORMAT,
} from "@/lib/profile/options";

/**
 * V3 Sprint 2 — Экран 3 «О себе».
 * Поля: bio (30-1000 симв с anti-contact фильтром) + education + activity_field +
 * employment_format. API: /api/onboarding/profile/self.
 */

export function V2AnketaSelfForm({
  locale,
  initial,
}: {
  locale: string;
  initial?: {
    bio?: string;
    education?: string;
    specialty?: string;
    activity_field?: string;
    activity_field_other?: string;
    employment_status?: string;
    employment_format?: string;
  };
}) {
  const t = useTranslations('Anketa');
  // Локализованные ошибки из i18n (как в AnketaBasicForm) — не хардкод RU.
  const errCopy: Record<string, string> = {
    bio_has_contacts: t("err_bio_has_contacts"),
    bio_too_short: t("err_bio_too_short"),
    bio_too_few_words: t("err_bio_too_few_words"),
    bio_too_long: t("err_bio_too_long"),
    validation: t("err_validation"),
    failed: t("err_failed"),
  };
  const router = useRouter();
  const [bio, setBio] = useState(initial?.bio ?? "");
  const [education, setEducation] = useState(initial?.education ?? "");
  const [specialty, setSpecialty] = useState(initial?.specialty ?? "");
  const [activityField, setActivityField] = useState(initial?.activity_field ?? "");
  const [activityFieldOther, setActivityFieldOther] = useState(
    initial?.activity_field_other ?? "",
  );
  const [employmentStatus, setEmploymentStatus] = useState(
    initial?.employment_status ?? "",
  );
  const [employmentFormat, setEmploymentFormat] = useState(
    initial?.employment_format ?? "",
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);

  // T-104 (правки оунера): «О себе» — от 50 до 500 СИМВОЛОВ, со счётчиком.
  const bioLen = bio.trim().length;
  const errors: Record<string, string> = {};
  if (!bio.trim()) errors.bio = t("err_field_required");
  else if (bioLen < 50) errors.bio = t("err_bio_too_short");
  else if (bioLen > 500) errors.bio = t("err_bio_too_long");
  if (!education) errors.education = t("err_select_required");
  if (!activityField) errors.activity_field = t("err_select_required");
  if (!employmentStatus) errors.employment_status = t("err_select_required");

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
      const res = await fetch("/api/onboarding/profile/self", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          bio,
          education,
          ...(showSpecialty && specialty.trim() ? { specialty: specialty.trim() } : {}),
          activity_field: activityField,
          ...(activityField === "other" && activityFieldOther.trim()
            ? { activity_field_other: activityFieldOther.trim() }
            : {}),
          employment_status: employmentStatus,
          ...(showWorkFormat && employmentFormat ? { employment_format: employmentFormat } : {}),
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

  const showWorkFormat = (EMPLOYMENT_WORKING_STATUSES as readonly string[]).includes(
    employmentStatus,
  );
  // Ревью оунера Экран 4: специальность показываем при высшем/среднем-спец/магистр/PhD/учусь.
  const showSpecialty = ["vocational", "higher", "master", "phd", "studying"].includes(education);

  return (
    <div>
      <Field
        label={t('bioLabel')}
        required
        hint={t('bio_char_counter', { current: bioLen })}
        error={showErrors ? errors.bio : undefined}
      >
        <TextArea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          rows={5}
          maxLength={1000}
          placeholder={t('bioPlaceholder')}
        />
      </Field>

      <Field label={t('educationLabel')} required error={showErrors ? errors.education : undefined}>
        <Select
          options={EDUCATION}
          value={education}
          onChange={setEducation}
          locale={locale}
        />
      </Field>

      {showSpecialty ? (
        <Field label={t('specialtyLabel')} hint={t('specialtyHint')}>
          <TextInput
            value={specialty}
            onChange={(e) => setSpecialty(e.target.value)}
            maxLength={80}
            placeholder={t('specialtyPlaceholder')}
          />
        </Field>
      ) : null}

      <Field
        label={t('activityFieldLabel')}
        required
        hint={t('activityFieldHint')}
        error={showErrors ? errors.activity_field : undefined}
      >
        <Select
          options={ACTIVITY_FIELDS}
          value={activityField}
          onChange={setActivityField}
          locale={locale}
        />
      </Field>

      {activityField === "other" ? (
        <Field label={t('activityOtherLabel')} hint={t('optionalHint')}>
          <TextInput
            value={activityFieldOther}
            onChange={(e) => setActivityFieldOther(e.target.value)}
            maxLength={80}
            placeholder={t('activityOtherPlaceholder')}
          />
        </Field>
      ) : null}

      <Field label={t('employmentStatusLabel')} required error={showErrors ? errors.employment_status : undefined}>
        <Select
          options={EMPLOYMENT_STATUS}
          value={employmentStatus}
          onChange={setEmploymentStatus}
          locale={locale}
        />
      </Field>

      {showWorkFormat ? (
        <Field label={t('employmentFormatLabel')} hint={t('optionalHint')}>
          <Select
            options={EMPLOYMENT_FORMAT}
            value={employmentFormat}
            onChange={setEmploymentFormat}
            locale={locale}
          />
        </Field>
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

      <Button
        variant="primary"
        onClick={submit}
        disabled={busy}
        style={{ width: "100%" }}
      >
        {busy ? t('btn_saving') : t('btn_next')}
      </Button>
    </div>
  );
}
