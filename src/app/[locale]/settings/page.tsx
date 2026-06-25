/**
 * V1 → V2 redirect. Settings переехал на /v2/settings.
 */

import { redirect } from "@/i18n/navigation";

export const dynamic = "force-dynamic";

export default async function SettingsRedirect({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect({ href: "/v2/settings", locale });
}
