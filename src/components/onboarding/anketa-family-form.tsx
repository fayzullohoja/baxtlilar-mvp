"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { postJson } from "@/lib/client/api";
import { PrimaryButton } from "@/components/ui/screen";
import { Field, Select } from "./fields";
import { MARITAL_STATUS, HAS_CHILDREN, CHILDREN_PLAN } from "@/lib/profile/options";

export function AnketaFamilyForm() {
  const t = useTranslations("Anketa");
  const tc = useTranslations("Common");
  const router = useRouter();
  const [marital, setMarital] = useState("");
  const [children, setChildren] = useState("");
  const [plan, setPlan] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setErr(null);
    const r = await postJson("/api/onboarding/profile/family", {
      marital_status: marital,
      has_children: children,
      children_plan: plan,
    });
    if (r.ok && r.next) router.push(r.next);
    else {
      setErr(t("err_check"));
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <Field label={t("marital_label")}>
        <Select options={MARITAL_STATUS} value={marital} onChange={setMarital} />
      </Field>
      <Field label={t("children_label")}>
        <Select options={HAS_CHILDREN} value={children} onChange={setChildren} />
      </Field>
      <Field label={t("children_plan_label")}>
        <Select options={CHILDREN_PLAN} value={plan} onChange={setPlan} />
      </Field>
      {err ? <p className="text-sm text-baxt-coral-dk">{err}</p> : null}
      <PrimaryButton onClick={submit} disabled={busy || !marital || !children || !plan}>
        {tc("continue")}
      </PrimaryButton>
    </div>
  );
}
