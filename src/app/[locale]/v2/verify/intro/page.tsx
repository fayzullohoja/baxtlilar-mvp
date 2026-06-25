/**
 * V2 Verification Intro (Blueprint §3.2 A3).
 *
 * Editorial вариант экрана между ботом и загрузкой паспорта. Объясняем
 * «зачем верификация», задаём ожидания по времени, и почему это работает
 * параллельно с анкетой (Shadow Active модель).
 */

import { setRequestLocale } from "next-intl/server";
import { requireUserAtStep } from "@/lib/state-machine/guard";
import { MiniAppShell } from "@/components/v2/MiniAppShell";
import { Headline, Lead } from "@/components/v2/Headline";
import { VerificationIntroCta } from "@/components/v2/VerificationIntroCta";

export const dynamic = "force-dynamic";

export default async function V2VerificationIntroPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireUserAtStep(locale, "verification_intro");

  return (
    <MiniAppShell
      eyebrow="Шаг 1 · Подтверждение"
      align="top"
      footer={<VerificationIntroCta />}
    >
      <Headline size="lg" as="h1">
        Подтвердим, что это&nbsp;ты.
      </Headline>
      <Lead>
        В Baxtlilar все профили с подтверждённым паспортом. Это не&nbsp;для
        бюрократии — это чтобы рядом с твоей анкетой не оказалось ботов и&nbsp;
        фейков.
      </Lead>

      <div
        style={{
          marginTop: "32px",
          paddingTop: "24px",
          borderTop: "1px solid var(--color-v2-ink-500)",
        }}
      >
        <Step n={1} title="Фото паспорта" body="Страница с фото и подписью. Только эту страницу — больше ничего не&nbsp;нужно." />
        <Step n={2} title="Селфи" body="Чтобы лицо на паспорте совпало с тем кто его подаёт." />
        <Step n={3} title="Ожидание" body="Модератор проверяет 2–4 часа. Пока он смотрит — ты не теряешь время, а проходишь анкету." />
      </div>

      <div
        style={{
          marginTop: "32px",
          paddingTop: "20px",
          borderTop: "1px solid var(--color-v2-ink-500)",
          fontSize: "12px",
          color: "var(--color-v2-ink-400)",
          fontFamily: "var(--font-v2-body)",
          lineHeight: "1.55",
        }}
      >
        Документы видит только модератор. Доступ к&nbsp;ним ограничен и&nbsp;
        логируется. Telegram-аккаунт мы видим только когда ты в&nbsp;приложении.
      </div>
    </MiniAppShell>
  );
}

function Step({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <div style={{ marginBottom: "24px" }}>
      <div
        style={{
          fontFamily: "var(--font-v2-display)",
          fontSize: "13px",
          letterSpacing: "0.1em",
          color: "var(--color-v2-ink-400)",
          marginBottom: "4px",
        }}
      >
        {String(n).padStart(2, "0")}
      </div>
      <div
        style={{
          fontFamily: "var(--font-v2-body)",
          fontSize: "17px",
          fontWeight: 500,
          color: "var(--color-v2-ink-100)",
          marginBottom: "4px",
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontFamily: "var(--font-v2-body)",
          fontSize: "14px",
          lineHeight: "1.5",
          color: "var(--color-v2-ink-300)",
        }}
      >
        {body}
      </div>
    </div>
  );
}
