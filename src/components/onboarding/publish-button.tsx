"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { postJson } from "@/lib/client/api";
import { PrimaryButton } from "@/components/ui/screen";

export function PublishButton() {
  const t = useTranslations("Anketa");
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function publish() {
    setBusy(true);
    setErr(null);
    const r = await postJson("/api/onboarding/profile/publish");
    if (r.ok && r.next) router.push(r.next);
    else {
      setErr(t("publish_err"));
      setBusy(false);
    }
  }

  return (
    <div>
      {err ? <p className="text-sm text-baxt-coral-dk mb-2">{err}</p> : null}
      <PrimaryButton onClick={publish} disabled={busy}>
        {t("publish")}
      </PrimaryButton>
    </div>
  );
}
