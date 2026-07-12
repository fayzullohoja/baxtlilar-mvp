"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button } from "./Button";
import { Field, Select } from "./AnketaFields";
import { PROFILE_VISIBILITY_MODE } from "@/lib/profile/options";

/**
 * V3 Sprint 3 — Экран 16 «Приватность» (MVP-версия).
 *
 * Только глобальный profile_visibility_mode (3 опции):
 * - public — открыт всем верифицированным
 * - verified_only — после взаимной верификации (ну, она у нас уже базой)
 * - by_request — по личному одобрению
 *
 * Per-block visibility — НЕ в MVP (учредительское решение).
 * Зарезервировано в extended.privacy.per_block для Sprint 4+.
 *
 * API: /api/onboarding/profile/privacy.
 */
export function V2AnketaPrivacyForm({
  locale,
  initial,
}: {
  locale: string;
  initial?: {
    profile_visibility_mode?: string;
  };
}) {
  const t = useTranslations('AnketaPrivacy');
  const router = useRouter();
  // Ревью оунера Экран 14: приватный по умолчанию (verified_only), не public.
  const [mode, setMode] = useState(
    initial?.profile_visibility_mode ?? "verified_only",
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/onboarding/profile/privacy", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ profile_visibility_mode: mode }),
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
        label={t('visibilityModeLabel')}
        required
        hint={t('visibilityModeHint')}
      >
        <Select
          options={PROFILE_VISIBILITY_MODE}
          value={mode}
          onChange={setMode}
          locale={locale}
        />
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
          {t('Errors.saveFailed')}
        </div>
      ) : null}

      <Button onClick={submit} disabled={busy || !mode} variant="primary">
        {busy ? t('Buttons.saving.next') : t('Anketa.btn_next')}
      </Button>
    </div>
  );
}
