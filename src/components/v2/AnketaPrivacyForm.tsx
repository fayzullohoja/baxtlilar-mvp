"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "./Button";
import { AnketaSubmitNotice } from "./AnketaSubmitNotice";
import { useAnketaSubmit } from "./useAnketaSubmit";
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
  const { busy, errorCode, stepMoved, submit: submitStep } = useAnketaSubmit(
    "/api/onboarding/profile/privacy",
  );
  // Ревью оунера Экран 14: приватный по умолчанию (verified_only), не public.
  const [mode, setMode] = useState(
    initial?.profile_visibility_mode ?? "verified_only",
  );

  async function submit() {
    if (busy) return;
    await submitStep({ profile_visibility_mode: mode });
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

      <AnketaSubmitNotice errorCode={errorCode} stepMoved={stepMoved} errorCopy={{ failed: t('Errors.saveFailed') }} />

      <Button onClick={submit} disabled={busy || !mode} variant="primary">
        {busy ? t('Buttons.saving.next') : t('Anketa.btn_next')}
      </Button>
    </div>
  );
}
