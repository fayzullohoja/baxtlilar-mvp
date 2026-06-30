"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button } from "./Button";
import { Field, Select, Chips } from "./AnketaFields";
import {
  RELIGION,
  RELIGION_PRACTICE,
  RELIGION_PARTNER_MATCH,
  LIFE_VALUES_V3,
} from "@/lib/profile/options";

/**
 * V2 Anketa Values form (Blueprint §3.3 B3).
 * Поля: религия, как практикую (4 опции вместо 1-5 шкалы),
 * желание совпадения у партнёра (опц), ценности (1-3), образование, занятость.
 * API: /api/onboarding/profile/values.
 *
 * V2 ext 2026-06-28: убран NumberScale "Насколько важна" (создавал ложное
 * "вера может быть неважна" для UZ-платформы). Заменено на качественный
 * Select про образ жизни + опциональное требование к партнёру.
 */

export function V2AnketaValuesForm({ locale }: { locale: string }) {
  const t = useTranslations('Anketa');
  const router = useRouter();
  const [religion, setReligion] = useState("");
  const [practice, setPractice] = useState("");
  const [partnerMatch, setPartnerMatch] = useState("");
  const [values, setValues] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function toggle(v: string) {
    setValues((cur) => (cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]));
  }

  async function submit() {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/onboarding/profile/values", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          religion,
          religion_practice: practice,
          ...(partnerMatch ? { religion_partner_match: partnerMatch } : {}),
          top_life_values: values,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok: boolean; next?: string };
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

  const valid =
    !!religion && !!practice && values.length >= 1 && values.length <= 3;

  return (
    <div>
      <Field label={t('religionLabel')} required>
        <Select options={RELIGION} value={religion} onChange={setReligion} locale={locale} />
      </Field>

      <Field
        label={t('religiousPracticeLabel')}
        required
        hint={t('religiousPracticeHint')}
      >
        <Select
          options={RELIGION_PRACTICE}
          value={practice}
          onChange={setPractice}
          locale={locale}
        />
      </Field>

      <Field
        label={t('partnerDesireLabel')}
        hint={t('partnerDesireHint')}
      >
        <Select
          options={RELIGION_PARTNER_MATCH}
          value={partnerMatch}
          onChange={setPartnerMatch}
          locale={locale}
        />
      </Field>

      <Field
        label={t('lifeValuesLabel')}
        required
        hint={t('lifeValuesHint')! + ` ${values.length}/3`}
      >
        <Chips options={LIFE_VALUES_V3} selected={values} onToggle={toggle} max={3} locale={locale} />
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
          {t('err_failed')}
        </div>
      ) : null}

      <Button onClick={submit} disabled={busy || !valid} variant="primary">
        {busy ? t('btn_saving') : t('btn_next')}
      </Button>
    </div>
  );
}
