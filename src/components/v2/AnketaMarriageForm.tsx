"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "./Button";
import { Field, Select } from "./AnketaFields";
import { POST_MARRIAGE_LIVING } from "@/lib/profile/options";
import { useTranslations } from 'next-intl';

/**
 * V2 ext 2026-06-28: новый шаг анкеты — формат проживания после брака.
 * Между values и looking-for. Ключевой матчинг-сигнал для serious-marriage
 * платформы. API: /api/onboarding/profile/marriage.
 */
export function V2AnketaMarriageForm({ locale }: { locale: string }) {
  const router = useRouter();
  const t = useTranslations('Anketa');
  const [living, setLiving] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/onboarding/profile/marriage", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ post_marriage_living: living }),
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
        label={t('marriage_format_label')}
        required
        hint={t('marriage_format_hint')}
      >
        <Select
          options={POST_MARRIAGE_LIVING}
          value={living}
          onChange={setLiving}
          locale={locale}
        />
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
            marginBottom: "24px",
          }}
        >
          {t('marriage_format_save_err')}
        </div>
      ) : null}

      <Button
        variant="primary"
        onClick={submit}
        disabled={!living || busy}
        style={{ width: "100%" }}
      >
        {busy ? t('marriage_format_saving') : t('marriage_format_next')}
      </Button>
    </div>
  );
}
