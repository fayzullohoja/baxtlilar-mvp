/**
 * V2 Anketa · Photos (Blueprint §3.3 B5).
 * 1-3 фото. Первое — основная.
 * API: /api/onboarding/profile/photo + photos-done.
 */

import { setRequestLocale } from "next-intl/server";
import { requireUserAtStep } from "@/lib/state-machine/guard";
import { MiniAppShell } from "@/components/v2/MiniAppShell";
import { Headline, Lead } from "@/components/v2/Headline";
import { V2AnketaPhotosForm } from "@/components/v2/AnketaPhotosForm";

export const dynamic = "force-dynamic";

export default async function V2AnketaPhotosPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireUserAtStep(locale, "profile_photos");

  return (
    <MiniAppShell eyebrow="Шаг 5 из 6 · Анкета" align="top">
      <Headline size="lg" as="h1">
        Фотографии.
      </Headline>
      <Lead>
        Не&nbsp;парадный снимок и не Tinder-постановка. Реальное лицо
        в&nbsp;нормальном свете. Без масок, очков и&nbsp;фильтров.
      </Lead>

      <div style={{ marginTop: "32px" }}>
        <V2AnketaPhotosForm />
      </div>
    </MiniAppShell>
  );
}
