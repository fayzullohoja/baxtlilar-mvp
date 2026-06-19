import { redirect } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { nextScreenFor } from "@/lib/state-machine/router";

export const dynamic = "force-dynamic";

// Корневая страница локали — простой dispatcher. Анонимный пользователь сюда не
// попадает (proxy.ts отдаёт /open-in-telegram). Авторизованный — кидаем на его
// текущий экран онбординга/ленты согласно state-machine.
export default async function LocaleIndexPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const user = await getCurrentUser();
  if (!user) {
    redirect({ href: "/open-in-telegram", locale });
  }
  redirect({ href: nextScreenFor(user!), locale });
}
