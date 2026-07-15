"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { Button } from "./Button";
import { Field, Select } from "./AnketaFields";
import { HEALTH_OPENNESS, MEDICAL_CHECK_WILLINGNESS, DRUGS_USE } from "@/lib/profile/options";

/**
 * §11 «Здоровье и особые обстоятельства» (ревью оунера 2026-07-14).
 * Оба поля optional (чувствительные — можно пропустить). COLD → extended.health.
 * Baxtlilar НЕ собирает диагнозы/справки/результаты. API: /api/onboarding/profile/health.
 */
export function V2AnketaHealthForm({
  locale,
  initial,
}: {
  locale: string;
  initial?: {
    health_openness?: string;
    medical_check_willingness?: string;
    substance_dependency_status?: string;
  };
}) {
  const router = useRouter();
  const t = useTranslations("Anketa");
  const [openness, setOpenness] = useState(initial?.health_openness ?? "");
  const [medical, setMedical] = useState(initial?.medical_check_willingness ?? "");
  const [substance, setSubstance] = useState(
    initial?.substance_dependency_status ?? "",
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/onboarding/profile/health", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...(openness ? { health_openness: openness } : {}),
          ...(medical ? { medical_check_willingness: medical } : {}),
          ...(substance ? { substance_dependency_status: substance } : {}),
        }),
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
      <Field label={t("health_openness_question")} hint={t("optionalHint")}>
        <Select
          options={HEALTH_OPENNESS}
          value={openness}
          onChange={setOpenness}
          locale={locale}
        />
      </Field>

      <Field
        label={t("medical_check_question")}
        hint={t("medical_check_hint")}
      >
        <Select
          options={MEDICAL_CHECK_WILLINGNESS}
          value={medical}
          onChange={setMedical}
          locale={locale}
        />
      </Field>

      {/* §1.10 substance — safety_only, не показывается другим юзерам. */}
      <Field label={t("substance_question")} hint={t("substance_hint")}>
        <Select
          options={DRUGS_USE}
          value={substance}
          onChange={setSubstance}
          locale={locale}
          placeholder="—"
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
          {t("err_failed")}
        </div>
      ) : null}

      <Button onClick={submit} disabled={busy} variant="primary">
        {busy ? t("btn_saving") : t("btn_next")}
      </Button>
    </div>
  );
}
