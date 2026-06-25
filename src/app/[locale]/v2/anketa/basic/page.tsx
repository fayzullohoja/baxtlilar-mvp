/**
 * V2 Anketa · Basic (Blueprint §3.3 B1).
 *
 * Editorial-redesign первого экрана анкеты. Backend API без изменений:
 * /api/onboarding/profile/basic принимает те же поля.
 */

import { setRequestLocale } from "next-intl/server";
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

  return (
    <MiniAppShell eyebrow="Шаг 1 из 6 · Анкета" align="top">
      <Headline size="lg" as="h1">
        Начнём с&nbsp;тебя.
      </Headline>
      <Lead>
        Базовое: как тебя зовут, сколько лет, где живёшь. Имя — то, как тебя
        увидят другие, потом не&nbsp;поменяется.
      </Lead>

      <div style={{ marginTop: "32px" }}>
        <V2AnketaBasicForm
          defaultName={user.telegram_first_name ?? ""}
          locale={locale}
        />
      </div>
    </MiniAppShell>
  );
}
