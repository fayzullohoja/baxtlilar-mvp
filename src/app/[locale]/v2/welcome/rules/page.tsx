/**
 * V2 ext 2026-06-28 — Welcome серия экран 3/3 (rules).
 *
 * Trust moment №3: правила взаимности + что делать если что-то не так.
 * State machine: welcome_rules → verification_intro.
 */

import { setRequestLocale } from "next-intl/server";
import { MiniAppShell } from "@/components/v2/MiniAppShell";
import { Headline, Lead } from "@/components/v2/Headline";
import { WelcomeStep } from "@/components/v2/WelcomeStep";

export const dynamic = "force-dynamic";

export default async function V2WelcomeRulesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <MiniAppShell
      eyebrow="Как это работает · 3 из 3"
      align="top"
      footer={<WelcomeStep cta="К&nbsp;верификации" />}
    >
      <Headline size="lg" as="h1">
        Знакомства строятся медленно.
      </Headline>
      <Lead>
        Здесь нельзя написать первому. Сначала&nbsp;— интерес: ты&nbsp;открываешь
        анкету целиком, читаешь, и&nbsp;если человек правда подходит&nbsp;—
        отправляешь личное сообщение.
      </Lead>
      <Lead style={{ marginTop: "24px" }}>
        Чат открывается только после взаимного интереса. До&nbsp;этого никто
        не&nbsp;тратит твоё внимание, и&nbsp;ты&nbsp;не&nbsp;тратишь чужое.
      </Lead>
      <Lead style={{ marginTop: "24px" }}>
        Если кто-то нарушает границы — кнопка «Пожаловаться» в&nbsp;один
        тап обрывает контакт. Модератор разбирается в&nbsp;течение 24&nbsp;часов.
      </Lead>
      <Lead style={{ marginTop: "24px", color: "var(--color-v2-ink-400)" }}>
        Готовы? На&nbsp;следующем шаге попросим паспорт и&nbsp;селфи.
      </Lead>
    </MiniAppShell>
  );
}
