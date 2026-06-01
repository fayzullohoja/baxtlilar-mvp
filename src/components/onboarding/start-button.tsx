"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { postJson } from "@/lib/client/api";
import { PrimaryButton } from "@/components/ui/screen";

export function StartButton() {
  const t = useTranslations("Welcome");
  const locale = useLocale();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function go() {
    setBusy(true);
    const r = await postJson("/api/onboarding/start", { language: locale });
    if (r.ok && r.next) router.push(r.next);
    else if (r.next) router.push(r.next);
    else setBusy(false);
  }

  return (
    <PrimaryButton onClick={go} disabled={busy}>
      {t("start")}
    </PrimaryButton>
  );
}
