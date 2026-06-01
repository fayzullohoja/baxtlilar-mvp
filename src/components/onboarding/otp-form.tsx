"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { postJson } from "@/lib/client/api";
import { PrimaryButton } from "@/components/ui/screen";

const ERR_KEY: Record<string, string> = {
  wrong_code: "otp_err_wrong",
  expired: "otp_err_expired",
  too_many_attempts: "otp_err_attempts",
  no_code: "otp_err_expired",
};

export function OtpForm() {
  const t = useTranslations("Onboarding");
  const router = useRouter();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resent, setResent] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    const r = await postJson("/api/onboarding/otp", { code });
    if (r.ok && r.next) router.push(r.next);
    else {
      setError(t(ERR_KEY[r.error ?? ""] ?? "otp_err_wrong"));
      setBusy(false);
    }
  }

  async function resend() {
    setError(null);
    const r = await postJson("/api/onboarding/otp", { action: "resend" });
    if (r.ok) setResent(true);
    else setError(t("phone_err_cooldown"));
  }

  return (
    <div className="space-y-4">
      <input
        type="text"
        inputMode="numeric"
        maxLength={6}
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
        placeholder="••••••"
        className="w-full text-center text-2xl tracking-[0.5em] rounded-2xl border border-baxt-border bg-white px-4 py-3 outline-none focus:border-baxt-coral"
      />
      {error ? <p className="text-sm text-baxt-coral-dk">{error}</p> : null}
      {resent ? <p className="text-sm text-baxt-muted">{t("otp_subtitle")}</p> : null}
      <PrimaryButton onClick={submit} disabled={busy || code.length < 4}>
        {t("otp_confirm")}
      </PrimaryButton>
      <button onClick={resend} className="w-full text-sm text-baxt-coral hover:underline py-1">
        {t("otp_resend")}
      </button>
    </div>
  );
}
