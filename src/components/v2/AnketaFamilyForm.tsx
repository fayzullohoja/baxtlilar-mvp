"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "./Button";
import { Field, Select } from "./AnketaFields";
import { MARITAL_STATUS, HAS_CHILDREN, CHILDREN_PLAN } from "@/lib/profile/options";

/**
 * V2 Anketa Family form (Blueprint §3.3 B2).
 * Поля: семейное положение, дети, планы по детям.
 * API: /api/onboarding/profile/family.
 */

export function V2AnketaFamilyForm({ locale }: { locale: string }) {
  const router = useRouter();
  const [marital, setMarital] = useState("");
  const [children, setChildren] = useState("");
  const [plan, setPlan] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/onboarding/profile/family", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          marital_status: marital,
          has_children: children,
          children_plan: plan,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok: boolean; next?: string; error?: string };
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

  const valid = !!marital && !!children && !!plan;

  return (
    <div>
      <Field label="Семейный статус">
        <Select options={MARITAL_STATUS} value={marital} onChange={setMarital} locale={locale} />
      </Field>
      <Field label="Дети">
        <Select options={HAS_CHILDREN} value={children} onChange={setChildren} locale={locale} />
      </Field>
      <Field
        label="Планы"
        hint="Как смотришь на детей в будущем — это поможет алгоритму."
      >
        <Select options={CHILDREN_PLAN} value={plan} onChange={setPlan} locale={locale} />
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
          Не получилось сохранить. Попробуй ещё раз.
        </div>
      ) : null}

      <Button onClick={submit} disabled={busy || !valid} variant="primary">
        {busy ? "Сохраняю…" : "Дальше"}
      </Button>
    </div>
  );
}
