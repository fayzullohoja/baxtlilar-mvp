"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { postJson } from "@/lib/client/api";
import { PrimaryButton } from "@/components/ui/screen";

export function RetryButton() {
  const t = useTranslations("Onboarding");
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function retry() {
    setBusy(true);
    const r = await postJson("/api/onboarding/retry");
    if (r.ok && r.next) router.push(r.next);
    else setBusy(false);
  }

  return (
    <PrimaryButton onClick={retry} disabled={busy}>
      {t("rejected_retry")}
    </PrimaryButton>
  );
}
