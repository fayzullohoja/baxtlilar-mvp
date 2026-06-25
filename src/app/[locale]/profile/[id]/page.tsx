/**
 * V1 → V2 redirect. Profile detail переехал на /v2/profile/[id].
 */

import { redirect } from "@/i18n/navigation";

export const dynamic = "force-dynamic";

export default async function ProfileRedirect({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  redirect({ href: `/v2/profile/${id}`, locale });
}
