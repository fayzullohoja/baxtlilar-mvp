import { setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { nextScreenFor } from "@/lib/state-machine/router";
import { MiniAppShell } from "@/components/v2/MiniAppShell";
import { Headline, Lead } from "@/components/v2/Headline";

export const dynamic = "force-dynamic";

/**
 * Терминальный экран удалённого аккаунта (C4). Раньше nextScreenFor(deleted)
 * вёл на "/", а LocaleIndexPage снова считал nextScreenFor(deleted)="/" —
 * бесконечная петля для юзера, который удалил аккаунт и переоткрыл мини-апп на
 * другом устройстве (сессия там ещё жива). Теперь — терминальный экран, не
 * редиректит deleted дальше.
 */
export default async function DeletedPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await getCurrentUser();
  if (!user) redirect({ href: "/", locale });
  if (user!.lifecycle_state !== "deleted") redirect({ href: nextScreenFor(user!), locale });

  return (
    <MiniAppShell eyebrow="Baxtlilar" align="center" footer={null}>
      <Headline size="lg" as="h1">
        Аккаунт удалён.
      </Headline>
      <Lead>
        Твои данные стёрты. Если захочешь вернуться — начни заново через бота
        @baxtlilar_uz_bot.
      </Lead>
      <Lead style={{ marginTop: "16px" }}>
        Hisobingiz oʻchirildi. Qaytishni istasangiz — @baxtlilar_uz_bot orqali
        qaytadan boshlang.
      </Lead>
    </MiniAppShell>
  );
}
