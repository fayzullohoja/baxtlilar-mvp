"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { postJson } from "@/lib/client/api";
import { PrimaryButton } from "@/components/ui/screen";
import { Field, Select, Chips } from "./fields";
import { RELIGION, RELIGION_IMPORTANCE, LIFE_VALUES, EDUCATION, EMPLOYMENT } from "@/lib/profile/options";

export function AnketaValuesForm() {
  const t = useTranslations("Anketa");
  const tc = useTranslations("Common");
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
    setBusy(true);
    setErr(null);
    const r = await postJson("/api/onboarding/profile/values", {
      religion,
      religion_importance: Number(importance),
      values,
      education,
      employment: employment || undefined,
    });
    if (r.ok && r.next) router.push(r.next);
    else {
      setErr(t("err_check"));
      setBusy(false);
    }
  }

  const valid = religion && importance && values.length >= 1 && values.length <= 3 && education;

  return (
    <div className="space-y-4">
      <Field label={t("religion_label")}>
        <Select options={RELIGION} value={religion} onChange={setReligion} />
      </Field>
      <Field label={t("religion_importance_label")}>
        <Select options={RELIGION_IMPORTANCE} value={importance} onChange={setImportance} />
      </Field>
      <Field label={t("values_label")}>
        <Chips options={LIFE_VALUES} selected={values} onToggle={toggle} max={3} />
        <span className="block text-xs text-baxt-muted mt-1.5">{t("values_hint")}</span>
      </Field>
      <Field label={t("education_label")}>
        <Select options={EDUCATION} value={education} onChange={setEducation} />
      </Field>
      <Field label={t("employment_label")}>
        <Select options={EMPLOYMENT} value={employment} onChange={setEmployment} />
      </Field>
      {err ? <p className="text-sm text-baxt-coral-dk">{err}</p> : null}
      <PrimaryButton onClick={submit} disabled={busy || !valid}>
        {tc("continue")}
      </PrimaryButton>
    </div>
  );
}
