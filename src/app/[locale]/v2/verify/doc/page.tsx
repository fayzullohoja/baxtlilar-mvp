/**
 * V2 Document Upload (Blueprint §3.2 A4).
 *
 * Editorial passport upload. Camera-first для mobile (back camera).
 * Existing API: /api/onboarding/document.
 */

import { setRequestLocale } from "next-intl/server";
import { requireUserAtStep } from "@/lib/state-machine/guard";
import { MiniAppShell } from "@/components/v2/MiniAppShell";
import { Headline, Lead } from "@/components/v2/Headline";
import { UploadField } from "@/components/v2/UploadField";

export const dynamic = "force-dynamic";

export default async function V2DocPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireUserAtStep(locale, "doc_upload");

  return (
    <MiniAppShell eyebrow="Шаг 1 · Паспорт" align="top">
      <Headline size="lg" as="h1">
        Страница с&nbsp;фотографией.
      </Headline>
      <Lead>
        Сними страницу паспорта с твоим фото и&nbsp;подписью. Только её —
        не нужно показывать прописку или другие развороты.
      </Lead>

      <div style={{ marginTop: "28px" }}>
        <Requirements />
      </div>

      <div style={{ marginTop: "32px" }}>
        <UploadField
          endpoint="/api/onboarding/document"
          uploadLabel="Сфотографировать или выбрать файл"
          capture="environment"
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
        Фото доступно только модератору и&nbsp;хранится в шифрованном
        хранилище. После одобрения профиля файл удаляется через 30 дней.
      </div>
    </MiniAppShell>
  );
}

function Requirements() {
  const items = [
    "Лицо хорошо видно",
    "Резкий фокус — буквы читаются",
    "Без бликов и&nbsp;тени поперёк",
    "Без редактирования — без фильтров, рамок и&nbsp;обложек",
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
