/**
 * V2 Tutorial Step 4/4 — SAFETY.
 *
 * Цель: сказать прямо что мы делаем когда что-то идёт не так.
 * Не клишированный "report", а конкретный SLA и&nbsp;что произойдёт.
 *
 * Финальный экран тура — кнопка "Готово" ведёт в /v2/welcome или /main
 * (router определит по lifecycle/verification_status).
 */

import { setRequestLocale } from "next-intl/server";
import { requireUserAtStep } from "@/lib/state-machine/guard";
import { MiniAppShell } from "@/components/v2/MiniAppShell";
import { Headline, Lead } from "@/components/v2/Headline";
import { TutorialStep } from "@/components/v2/TutorialStep";
import { StepDots } from "@/components/v2/StepDots";

export const dynamic = "force-dynamic";

export default async function TutorialSafetyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireUserAtStep(locale, "tutorial_safety");

  return (
    <MiniAppShell
      eyebrow="Знакомство · 4 из 4"
      align="top"
      footer={<TutorialStep cta="Готово" showSkip={false} />}
    >
      <StepDots total={4} current={4} />
      <Headline size="lg" as="h1">
        Если что-то не&nbsp;так — скажи.
      </Headline>
      <Lead>
        В&nbsp;любом профиле и&nbsp;в&nbsp;любом чате есть&nbsp;
        <em>Пожаловаться</em>. Модератор смотрит каждую жалобу. Решение приходит
        в&nbsp;течение 24&nbsp;часов.
      </Lead>
      <Lead style={{ marginTop: "20px" }}>
        Если человек неприятен — заблокируй. Он не&nbsp;увидит тебя в&nbsp;ленте,
        не&nbsp;сможет писать, не&nbsp;узнает что ты его заблокировал.
      </Lead>
      <Lead style={{ marginTop: "20px" }}>
        Анкета остаётся приватной до взаимного интереса. Фото нельзя сохранить
        кнопкой &laquo;скачать&raquo;.
      </Lead>
    </MiniAppShell>
  );
}
