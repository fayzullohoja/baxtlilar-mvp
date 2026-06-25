/**
 * V2 Selfie Liveness (Blueprint §3.2 A5).
 *
 * Селфи рядом с паспортом — модератор сверяет лицо. Camera-first front.
 * Existing API: /api/onboarding/selfie.
 */

import { setRequestLocale } from "next-intl/server";
import { requireUserAtStep } from "@/lib/state-machine/guard";
import { MiniAppShell } from "@/components/v2/MiniAppShell";
import { Headline, Lead } from "@/components/v2/Headline";
import { UploadField } from "@/components/v2/UploadField";

export const dynamic = "force-dynamic";

export default async function V2SelfiePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireUserAtStep(locale, "selfie_upload");

  return (
    <MiniAppShell eyebrow="Шаг 2 · Селфи" align="top">
      <Headline size="lg" as="h1">
        Селфи с&nbsp;паспортом.
      </Headline>
      <Lead>
        Сделай селфи, держа паспорт рядом с лицом так, чтобы и твоё лицо,
        и&nbsp;фото в паспорте были видны на одной фотографии.
      </Lead>

      <div style={{ marginTop: "28px" }}>
        <Requirements />
      </div>

      <div style={{ marginTop: "32px" }}>
        <UploadField
          endpoint="/api/onboarding/selfie"
          uploadLabel="Сделать селфи"
          capture="user"
        />
      </div>

      <div
        style={{
          marginTop: "28px",
          paddingTop: "20px",
          borderTop: "1px solid var(--color-v2-ink-500)",
          fontSize: "12px",
          color: "var(--color-v2-ink-400)",
          fontFamily: "var(--font-v2-body)",
          lineHeight: "1.55",
        }}
      >
        После загрузки заявка уходит на модерацию. Параллельно ты сможешь
        заполнить анкету и&nbsp;пройти психо-портрет — это не блокируется
        ожиданием. Решение модератора придёт в&nbsp;Telegram.
      </div>
    </MiniAppShell>
  );
}

function Requirements() {
  const items = [
    "Лицо без маски, очков, шляпы",
    "Естественное освещение — не лампа сверху",
    "Паспорт развернут к&nbsp;камере, рядом с&nbsp;лицом",
    "Не пересняй чужое фото — это блокировка без апелляции",
  ];
  return (
    <div>
      <div
        style={{
          fontSize: "11px",
          textTransform: "uppercase",
          letterSpacing: "0.12em",
          color: "var(--color-v2-ink-400)",
          marginBottom: "10px",
          fontFamily: "var(--font-v2-body)",
        }}
      >
        Требования
      </div>
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {items.map((item, i) => (
          <li
            key={i}
            style={{
              fontFamily: "var(--font-v2-body)",
              fontSize: "14px",
              lineHeight: "1.55",
              color: "var(--color-v2-ink-200)",
              marginBottom: "8px",
              paddingLeft: "14px",
              position: "relative",
            }}
          >
            <span
              style={{
                position: "absolute",
                left: 0,
                top: "10px",
                width: "5px",
                height: "1px",
                background: "var(--color-v2-ink-300)",
              }}
            />
            <span dangerouslySetInnerHTML={{ __html: item }} />
          </li>
        ))}
      </ul>
    </div>
  );
}
