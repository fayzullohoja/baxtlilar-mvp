"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "./Button";
import { Field, Select, Chips, NumberScale } from "./AnketaFields";
import { RELIGION, LIFE_VALUES, EDUCATION, EMPLOYMENT } from "@/lib/profile/options";

/**
 * V2 Anketa Values form (Blueprint §3.3 B3).
 * Поля: религия, важность религии, ценности (1-3), образование, занятость.
 * API: /api/onboarding/profile/values.
 */

export function V2AnketaValuesForm({ locale }: { locale: string }) {
  const router = useRouter();
  const [religion, setReligion] = useState("");
  const [importance, setImportance] = useState("");
  const [values, setValues] = useState<string[]>([]);
  const [education, setEducation] = useState("");
  const [employment, setEmployment] = useState("");
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
          religion_importance: Number(importance),
          values,
          education,
          employment: employment || undefined,
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
    !!religion && !!importance && values.length >= 1 && values.length <= 3 && !!education;

  return (
    <div>
      <Field label="Вероисповедание">
        <Select options={RELIGION} value={religion} onChange={setReligion} locale={locale} />
      </Field>
      <Field
        label="Насколько важна"
        hint="1 — почти не играет роли. 5 — определяет жизнь."
      >
        <NumberScale
          min={1}
          max={5}
          value={importance}
          onChange={setImportance}
          labels={{ min: "не важна", max: "очень важна" }}
        />
      </Field>
      <Field
        label="Что важно в жизни"
        hint={`Выбери от 1 до 3 — что отражает тебя. Выбрано: ${values.length}/3`}
      >
        <Chips options={LIFE_VALUES} selected={values} onToggle={toggle} max={3} locale={locale} />
      </Field>
      <Field label="Образование">
        <Select options={EDUCATION} value={education} onChange={setEducation} locale={locale} />
      </Field>
      <Field label="Занятость">
        <Select options={EMPLOYMENT} value={employment} onChange={setEmployment} locale={locale} />
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
