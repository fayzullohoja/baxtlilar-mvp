/**
 * V2 Anketa · Basic (Blueprint §3.3 B1).
 *
 * Editorial-redesign первого экрана анкеты. Backend API без изменений:
 * /api/onboarding/profile/basic принимает те же поля.
 */

import { setRequestLocale, getTranslations } from "next-intl/server";
import { requireUserAtStep } from "@/lib/state-machine/guard";
import { MiniAppShell } from "@/components/v2/MiniAppShell";
import { Headline, Lead } from "@/components/v2/Headline";
import { V2AnketaBasicForm } from "@/components/v2/AnketaBasicForm";

export const dynamic = "force-dynamic";

export default async function V2AnketaBasicPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUserAtStep(locale, "profile_basic");
  const t = await getTranslations("Anketa");

  return (
    <MiniAppShell eyebrow={t("basic_eyebrow")} align="top">
      <Headline size="lg" as="h1">
        {t("basic_headline")}
      </Headline>
      <Lead>{t("basic_lead")}</Lead>

      <div style={{ marginTop: "32px" }}>
        <V2AnketaBasicForm
          defaultName={user.telegram_first_name ?? ""}
          locale={locale}
        />
      </div>
    </MiniAppShell>
  );
}
