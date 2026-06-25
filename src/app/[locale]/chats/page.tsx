/**
 * V1 → V2 redirect. После V2 Sprint 13 chat list переехал на /v2/chats.
 * BottomNav остаётся на /chats — этот redirect ведёт пользователя в V2.
 *
 * Sweep V1 страницы целиком — Sprint 20.
 */

import { redirect } from "@/i18n/navigation";

export const dynamic = "force-dynamic";

export default async function ChatsRedirect({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect({ href: "/v2/chats", locale });
}
