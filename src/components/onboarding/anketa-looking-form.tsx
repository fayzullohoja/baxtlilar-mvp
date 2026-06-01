"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { postJson } from "@/lib/client/api";
import { PrimaryButton } from "@/components/ui/screen";
import { Field, Select, TextInput } from "./fields";
import { GEO_PREFERENCE } from "@/lib/profile/options";

export function AnketaLookingForm() {
  const t = useTranslations("Anketa");
  const tc = useTranslations("Common");
  const router = useRouter();
  const [min, setMin] = useState("");
  const [max, setMax] = useState("");
  const [geo, setGeo] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setErr(null);
    const r = await postJson("/api/onboarding/profile/looking-for", {
      partner_age_min: Number(min),
      partner_age_max: Number(max),
      geo_preference: geo,
    });
    if (r.ok && r.next) router.push(r.next);
    else {
      setErr(t("err_age"));
      setBusy(false);
    }
  }

  const valid = !!geo && Number(min) >= 18 && Number(max) >= 18 && Number(max) >= Number(min);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("age_min_label")}>
          <TextInput type="number" inputMode="numeric" min={18} max={100} value={min} onChange={(e) => setMin(e.target.value)} />
        </Field>
        <Field label={t("age_max_label")}>
          <TextInput type="number" inputMode="numeric" min={18} max={100} value={max} onChange={(e) => setMax(e.target.value)} />
        </Field>
      </div>
      <Field label={t("geo_label")}>
        <Select options={GEO_PREFERENCE} value={geo} onChange={setGeo} />
      </Field>
      {err ? <p className="text-sm text-baxt-coral-dk">{err}</p> : null}
      <PrimaryButton onClick={submit} disabled={busy || !valid}>
        {tc("continue")}
      </PrimaryButton>
    </div>
  );
}
