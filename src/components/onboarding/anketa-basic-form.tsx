"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { postJson } from "@/lib/client/api";
import { PrimaryButton } from "@/components/ui/screen";
import { Field, TextInput, TextArea, Select, CitySelect } from "./fields";
import { GENDER } from "@/lib/profile/options";

export function AnketaBasicForm({ defaultName }: { defaultName?: string }) {
  const t = useTranslations("Anketa");
  const tc = useTranslations("Common");
  const router = useRouter();
  const [name, setName] = useState(defaultName ?? "");
  const [gender, setGender] = useState("");
  const [birth, setBirth] = useState("");
  const [city, setCity] = useState("");
  const [bio, setBio] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setErr(null);
    const r = await postJson("/api/onboarding/profile/basic", {
      display_name: name,
      gender,
      birth_date: birth,
      city,
      bio,
    });
    if (r.ok && r.next) router.push(r.next);
    else {
      setErr(r.detail === "bio_has_contacts" ? t("bio_no_contacts") : t("err_check"));
      setBusy(false);
    }
  }

  const valid =
    name.trim().length >= 2 && !!gender && !!birth && !!city && bio.trim().length >= 20;

  return (
    <div className="space-y-4">
      <Field label={t("name_label")}>
        <TextInput value={name} onChange={(e) => setName(e.target.value)} maxLength={50} />
      </Field>
      <Field label={t("gender_label")}>
        <Select options={GENDER} value={gender} onChange={setGender} />
      </Field>
      <Field label={t("birth_label")}>
        <TextInput type="date" value={birth} onChange={(e) => setBirth(e.target.value)} />
      </Field>
      <Field label={t("city_label")}>
        <CitySelect value={city} onChange={setCity} placeholder={t("city_placeholder")} />
      </Field>
      <Field label={t("bio_label")}>
        <TextArea value={bio} onChange={(e) => setBio(e.target.value)} placeholder={t("bio_hint")} />
      </Field>
      {err ? <p className="text-sm text-baxt-coral-dk">{err}</p> : null}
      <PrimaryButton onClick={submit} disabled={busy || !valid}>
        {tc("continue")}
      </PrimaryButton>
    </div>
  );
}
