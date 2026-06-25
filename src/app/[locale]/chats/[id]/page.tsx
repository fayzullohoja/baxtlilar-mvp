/**
 * V1 → V2 redirect. Chat detail переехал на /v2/chats/[id].
 */

import { redirect } from "@/i18n/navigation";

export const dynamic = "force-dynamic";

export default async function ChatThreadRedirect({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  redirect({ href: `/v2/chats/${id}`, locale });
}
