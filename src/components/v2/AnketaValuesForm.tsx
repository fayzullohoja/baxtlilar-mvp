"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button } from "./Button";
import { Field, Select, Chips } from "./AnketaFields";
import {
  RELIGION,
  LIFE_VALUES_V3,
} from "@/lib/profile/options";

/**
 * V2 Anketa Values form (Blueprint §3.3 B3).
 * Поля: религия, ценности (1-3).
 *
 * V4 (2026-06-30): убран follow-up religion_practice («как Вы с этим живёте») —
 * учредительская поправка №5. Также убран religion_partner_match — переехал в
 * partner-extended (учредительская поправка №10: раздел «Кого ищу»).
 * API: /api/onboarding/profile/values.
 */

export function V2AnketaValuesForm({
  locale,
  initial,
}: {
  locale: string;
  initial?: {
    religion?: string;
    top_life_values?: string[];
  };
}) {
  const t = useTranslations('Anketa');
  const router = useRouter();
  const [religion, setReligion] = useState(initial?.religion ?? "");
  const [values, setValues] = useState<string[]>(initial?.top_life_values ?? []);
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
          // Вера опциональна — отправляем только если выбрана (пустую не шлём).
          ...(religion ? { religion } : {}),
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

  const valid = values.length >= 1 && values.length <= 3;

  return (
    <div>
      <Field label={t('religionLabel')} hint={t('optionalHint')}>
        <Select options={RELIGION} value={religion} onChange={setReligion} locale={locale} />
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
            background: "#FBE7E4",
            borderLeft: "3px solid var(--color-v2-danger)",
            borderRadius: "12px",
            fontSize: "13px",
            color: "#9A4B46",
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
