"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { postJson } from "@/lib/client/api";
import { PrimaryButton } from "@/components/ui/screen";

export function ConsentForm() {
  const t = useTranslations("Onboarding");
  const tc = useTranslations("Common");
  const router = useRouter();
  const [serious, setSerious] = useState(false);
  const [rules, setRules] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    const r = await postJson("/api/onboarding/consent");
    if (r.ok && r.next) router.push(r.next);
    else {
      setError(tc("error_generic"));
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <label className="flex gap-3 items-start text-sm cursor-pointer">
        <input
          type="checkbox"
          checked={serious}
          onChange={(e) => setSerious(e.target.checked)}
          className="mt-0.5 accent-baxt-coral w-4 h-4"
        />
        <span>{t("consent_check_serious")}</span>
      </label>
      <label className="flex gap-3 items-start text-sm cursor-pointer">
        <input
          type="checkbox"
          checked={rules}
          onChange={(e) => setRules(e.target.checked)}
          className="mt-0.5 accent-baxt-coral w-4 h-4"
        />
        <span>{t("consent_check_rules")}</span>
      </label>
      {error ? <p className="text-sm text-baxt-coral-dk">{error}</p> : null}
      <PrimaryButton onClick={submit} disabled={!serious || !rules || busy}>
        {tc("continue")}
      </PrimaryButton>
    </div>
  );
}
