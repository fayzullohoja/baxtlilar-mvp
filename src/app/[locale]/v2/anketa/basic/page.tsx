/**
 * V2 Anketa · Basic (Blueprint §3.3 B1).
 *
 * Editorial-redesign первого экрана анкеты. Backend API без изменений:
 * /api/onboarding/profile/basic принимает те же поля.
 */

import { setRequestLocale, getTranslations } from "next-intl/server";
import { requireUserAtStep } from "@/lib/state-machine/guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
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

  // Ревью оунера (name-split + gender-lock): к profile_basic верификация уже
  // пройдена, значит модератор внёс user_identity (ФИО + пол из документа).
  // Пол блокируем на верифицированное значение; ФИО показываем read-only как
  // приватный контекст. Берём активную (не superseded) identity.
  const { data: identity } = await supabaseAdmin()
    .from("user_identity")
    .select("gender, first_name, last_name, middle_name")
    .eq("user_id", user.id)
    .is("superseded_at", null)
    .maybeSingle();
  const g = (identity?.gender as string | null)?.trim().toLowerCase();
  const verifiedGender = g === "m" || g === "f" ? g : null;
  const verifiedLegalName = identity
    ? [identity.last_name, identity.first_name, identity.middle_name]
        .map((s) => (s as string | null)?.trim())
        .filter(Boolean)
        .join(" ") || null
    : null;

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
          verifiedGender={verifiedGender}
          verifiedLegalName={verifiedLegalName}
        />
      </div>
    </MiniAppShell>
  );
}
