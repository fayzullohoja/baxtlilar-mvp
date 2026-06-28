/**
 * V2 ext 2026-06-28 — Welcome серия экран 2/3 (safety).
 *
 * Trust moment №2: verification + модерация + приватность.
 * State machine: welcome_safety → welcome_rules.
 */

import { setRequestLocale } from "next-intl/server";
import { MiniAppShell } from "@/components/v2/MiniAppShell";
import { Headline, Lead } from "@/components/v2/Headline";
import { WelcomeStep } from "@/components/v2/WelcomeStep";

export const dynamic = "force-dynamic";

export default async function V2WelcomeSafetyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <MiniAppShell
      eyebrow="Безопасность · 2 из 3"
      align="center"
      footer={<WelcomeStep />}
    >
      <Headline size="lg" as="h1">
        Каждый профиль здесь&nbsp;— настоящий.
      </Headline>
      <Lead>
        Прежде чем тебя увидят другие, модератор проверяет твой паспорт
        и&nbsp;селфи вручную. Без этой проверки нельзя ни&nbsp;писать, ни&nbsp;быть
        в&nbsp;ленте. Так мы&nbsp;убираем катфишинг и&nbsp;поддельные аккаунты.
      </Lead>
      <Lead style={{ marginTop: "24px" }}>
        Твой паспорт и&nbsp;селфи никто кроме модератора не&nbsp;увидит. Фото
        твоего профиля защищены от&nbsp;скачивания. Личные данные (телефон,
        ПИНФЛ, адрес) не&nbsp;показываются никому из&nbsp;юзеров.
      </Lead>
      <Lead style={{ marginTop: "24px" }}>
        Проверка занимает 2&ndash;4&nbsp;часа. Пока ты&nbsp;ждёшь, можешь
        заполнить анкету&nbsp;— это никого не&nbsp;задержит.
      </Lead>
    </MiniAppShell>
  );
}
