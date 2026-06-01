"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { postJson } from "@/lib/client/api";
import { PrimaryButton } from "@/components/ui/screen";

const ERR_KEY: Record<string, string> = {
  invalid_phone: "phone_err_invalid",
  phone_taken: "phone_err_taken",
  cooldown: "phone_err_cooldown",
  hourly_limit: "phone_err_cooldown",
};

export function PhoneForm() {
  const t = useTranslations("Onboarding");
  const tc = useTranslations("Common");
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    const r = await postJson("/api/onboarding/phone", { phone });
    if (r.ok && r.next) router.push(r.next);
    else {
      const key = ERR_KEY[r.error ?? ""] ?? null;
      setError(key ? t(key) : tc("error_generic"));
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center rounded-2xl border border-baxt-border bg-white px-4 py-3 focus-within:border-baxt-coral">
        <span className="text-baxt-muted mr-2">+998</span>
        <input
          type="tel"
          inputMode="numeric"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder={t("phone_placeholder")}
          className="flex-1 outline-none bg-transparent text-baxt-navy"
        />
      </div>
      <p className="text-xs text-baxt-muted">{t("phone_hint")}</p>
      {error ? <p className="text-sm text-baxt-coral-dk">{error}</p> : null}
      <PrimaryButton onClick={submit} disabled={busy || phone.replace(/\D/g, "").length < 9}>
        {t("phone_get_code")}
      </PrimaryButton>
    </div>
  );
}
