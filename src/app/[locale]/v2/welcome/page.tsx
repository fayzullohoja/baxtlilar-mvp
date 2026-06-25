/**
 * V2 Welcome — первый экран мини-аппы после bootstrap.
 *
 * Цель: Manifesto. До любого ввода данных юзер должен понять что это.
 * Hinge-приём: "Designed to be deleted" → наш аналог "Знакомства,
 * после которых не свайпают дальше".
 *
 * Trust moment №1 (см. Discovery → Trust strategy):
 *   - Editorial типографика как hero
 *   - Один parking-message про verification как floor
 *   - Один CTA: "Начать"
 */

import { setRequestLocale } from "next-intl/server";
import { MiniAppShell } from "@/components/v2/MiniAppShell";
import { Button } from "@/components/v2/Button";
import { Headline, Lead } from "@/components/v2/Headline";
import { Link } from "@/i18n/navigation";

export const dynamic = "force-dynamic";

export default async function V2WelcomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <MiniAppShell
      eyebrow="Baxtlilar · приватные знакомства"
      align="center"
      footer={
        <Link href="/v2/tutorial/intro" style={{ textDecoration: "none" }}>
          <Button variant="primary">Начать</Button>
        </Link>
      }
    >
      <Headline size="xl" as="h1">
        Знакомства,&nbsp;после которых не&nbsp;свайпают дальше.
      </Headline>
      <Lead>
        Каждый профиль здесь — с подтверждённым паспортом. Editorial формат
        вместо &laquo;мясного рынка&raquo;. Без свайпов, без confetti, без игр.
      </Lead>
      <Lead style={{ marginTop: "32px" }}>
        Тебя не покажут другим, пока модератор не подтвердит твою личность.
        Это занимает 2&ndash;4 часа.
      </Lead>
    </MiniAppShell>
  );
}
