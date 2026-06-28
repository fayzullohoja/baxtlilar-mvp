/**
 * V2 ext 2026-06-28 — Welcome серия экран 1/3 (mission).
 *
 * Первый экран мини-аппы после bot-флоу. До любого ввода данных юзер
 * понимает что это: тёплое приветствие + миссия для семейной платформы UZ.
 *
 * State machine: welcome_mission → welcome_safety.
 * Predecessor: bot_consent_biometric (последний шаг бот-флоу).
 *
 * Editorial trust moment №1:
 *   - Editorial типографика как hero
 *   - Тёплое личное обращение
 *   - Один CTA: "Дальше"
 */

import { setRequestLocale } from "next-intl/server";
import { MiniAppShell } from "@/components/v2/MiniAppShell";
import { Headline, Lead } from "@/components/v2/Headline";
import { WelcomeStep } from "@/components/v2/WelcomeStep";

export const dynamic = "force-dynamic";

export default async function V2WelcomeMissionPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <MiniAppShell
      eyebrow="Baxtlilar · 1 из 3"
      align="center"
      footer={<WelcomeStep />}
    >
      <Headline size="xl" as="h1">
        Здесь&nbsp;ищут спутника жизни, не&nbsp;развлечение.
      </Headline>
      <Lead>
        Baxtlilar — для тех, кто готов к&nbsp;серьёзным отношениям и&nbsp;браку.
        Каждый профиль здесь — с&nbsp;подтверждённым паспортом. Без свайпов,
        без&nbsp;игр, без&nbsp;«мясного рынка».
      </Lead>
      <Lead style={{ marginTop: "24px" }}>
        Мы&nbsp;уважаем традиции, культуру и&nbsp;время твоей семьи. Поэтому
        каждое знакомство здесь — продуманное, а&nbsp;не&nbsp;случайное.
      </Lead>
    </MiniAppShell>
  );
}
