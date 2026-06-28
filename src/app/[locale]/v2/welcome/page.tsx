/**
 * V3 Sprint 3 round 3 — Branded welcome (single screen).
 *
 * Заменяет 3-экранную editorial серию (mission/safety/rules) на одну
 * брендированную страницу. Дизайн от учредителя (2026-06-29 тест-проход).
 *
 * State machine: welcome_mission → verification_intro (welcome_safety и
 * welcome_rules больше не используются, но enum-значения оставлены для
 * совместимости с legacy юзерами).
 */

import { setRequestLocale } from "next-intl/server";
import { WelcomeBranded } from "@/components/v2/WelcomeBranded";

export const dynamic = "force-dynamic";

export default async function V2WelcomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <WelcomeBranded locale={locale} />;
}
