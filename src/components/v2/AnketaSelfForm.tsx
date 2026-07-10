"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button } from "./Button";
import { Field, Select, TextArea } from "./AnketaFields";
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
const ERR_COPY: Record<string, string> = {
  bio_has_contacts:
    "В тексте нашёлся контакт (телефон, ник, ссылка). Удали — здесь это не работает.",
  bio_too_short: "Расскажи побольше — минимум 30 символов.",
  bio_too_long: "Слишком длинно — максимум 1000 символов.",
  validation: "Проверь заполненные поля.",
  failed: "Не получилось сохранить. Попробуй ещё раз.",
};

export function V2AnketaSelfForm({ locale }: { locale: string }) {
  const t = useTranslations('Anketa');
  const router = useRouter();
  const [bio, setBio] = useState("");
  const [education, setEducation] = useState("");
  const [activityField, setActivityField] = useState("");
  const [employmentStatus, setEmploymentStatus] = useState("");
  const [employmentFormat, setEmploymentFormat] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/onboarding/profile/self", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          bio,
          education,
          activity_field: activityField,
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
  const valid =
    bio.trim().length >= 30 &&
    bio.trim().length <= 1000 &&
    !!education &&
    !!activityField &&
    !!employmentStatus;

  return (
    <div>
      <Field
        label={t('bioLabel')}
        required
        hint={t('bioHint')}
      >
        <TextArea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          rows={5}
          maxLength={1000}
          placeholder={t('bioPlaceholder')}
        />
      </Field>

      <Field label={t('educationLabel')} required>
        <Select
          options={EDUCATION}
          value={education}
          onChange={setEducation}
          locale={locale}
        />
      </Field>

      <Field
        label={t('activityFieldLabel')}
        required
        hint={t('activityFieldHint')}
      >
        <Select
          options={ACTIVITY_FIELDS}
          value={activityField}
          onChange={setActivityField}
          locale={locale}
        />
      </Field>

      <Field label={t('employmentStatusLabel')} required>
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
          {ERR_COPY[err] ?? ERR_COPY.failed}
        </div>
      ) : null}

      <Button
        variant="primary"
        onClick={submit}
        disabled={!valid || busy}
        style={{ width: "100%" }}
      >
        {busy ? t('btn_saving') : t('btn_next')}
      </Button>
    </div>
  );
}
