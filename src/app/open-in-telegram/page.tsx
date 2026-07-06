import { AutoBootstrap } from "./auto-bootstrap";

export const dynamic = "force-dynamic";

const BOT_USERNAME = process.env.BOT_USERNAME ?? "baxtlilar_uz_bot";

// Точка входа для анонимного пользователя. Внутри TG WebView AutoBootstrap сам
// авторизует и редиректит; в обычном браузере (mini-app там не открыть) —
// показываем этот брендовый лендинг с deep-link на бота. V2 Editorial Premium:
// тёплая бумага, serif-masthead, один аметистовый акцент, максимум сдержанности.
//
// Анимация — одна оркестрованная «сцена появления»: элементы поднимаются по
// очереди (bx-rise), аметистовый штрих прочерчивается слева (bx-draw), CTA даёт
// тактильный отклик на нажатие. Никаких idle-петель (они читаются как AI). Всё
// уважает prefers-reduced-motion.
// Вход синхронизирован с уходом лоадера: AutoBootstrap ставит на <body>
// data-tg-landing="1" в момент, когда открывает лендинг — тогда и стартует
// stagger. Без JS/до флага элементы просто видимы (SSR-safe, без «мигания»).
const ENTRANCE_CSS = `
@keyframes bxRise { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
@keyframes bxDraw { from { transform: scaleX(0); } to { transform: scaleX(1); } }
.bx-draw { transform-origin: left center; }
.bx-cta { transition: transform 0.18s ease, box-shadow 0.18s ease, opacity 0.18s ease; }
.bx-cta:active { transform: translateY(1px) scale(0.985); box-shadow: 0 6px 18px -12px rgba(74,44,90,0.6); opacity: 0.94; }
body[data-tg-landing="1"] .bx-rise { animation: bxRise 0.7s cubic-bezier(0.16,0.84,0.44,1) both; }
body[data-tg-landing="1"] .bx-draw { animation: bxDraw 0.65s cubic-bezier(0.16,0.84,0.44,1) both; }
@media (prefers-reduced-motion: reduce) {
  body[data-tg-landing="1"] .bx-rise, body[data-tg-landing="1"] .bx-draw { animation: none; }
  .bx-cta { transition: none; }
}
`;

export default function OpenInTelegramPage() {
  const botDeepLink = `https://t.me/${BOT_USERNAME}`;
  return (
    <main
      className="relative flex min-h-screen flex-col items-center justify-center"
      style={{
        background: "var(--color-v2-paper)",
        color: "var(--color-v2-ink-100)",
        fontFamily: "var(--font-v2-body)",
        padding: "40px 28px",
      }}
    >
      <style>{ENTRANCE_CSS}</style>
      <AutoBootstrap />

      <div style={{ width: "100%", maxWidth: 400 }}>
        <div
          className="bx-rise uppercase"
          style={{
            fontFamily: "var(--font-v2-mono)",
            fontSize: 11,
            letterSpacing: "0.2em",
            color: "var(--color-v2-ink-400)",
            marginBottom: 24,
            animationDelay: "0.05s",
          }}
        >
          Серьёзные знакомства
        </div>

        <h1
          className="bx-rise"
          style={{
            fontFamily: "var(--font-v2-display)",
            fontSize: 54,
            lineHeight: 1,
            letterSpacing: "-0.02em",
            fontWeight: 400,
            margin: 0,
            color: "var(--color-v2-ink-100)",
            animationDelay: "0.14s",
          }}
        >
          Baxtlilar
        </h1>

        {/* Signature: одиночный аметистовый штрих-мачта под словесным знаком. */}
        <div
          aria-hidden
          className="bx-draw"
          style={{
            width: 56,
            height: 2,
            background: "var(--color-v2-accent)",
            margin: "22px 0 24px",
            animationDelay: "0.32s",
          }}
        />

        <p
          className="bx-rise"
          style={{
            fontFamily: "var(--font-v2-display)",
            fontSize: 22,
            lineHeight: 1.35,
            fontWeight: 400,
            color: "var(--color-v2-ink-300)",
            margin: "0 0 40px",
            maxWidth: 300,
            animationDelay: "0.44s",
          }}
        >
          Здесь знакомятся, чтобы создать семью.
        </p>

        <a
          href={botDeepLink}
          className="bx-rise bx-cta block"
          style={{
            background: "var(--color-v2-accent)",
            color: "var(--color-v2-paper)",
            fontFamily: "var(--font-v2-body)",
            fontSize: 16,
            fontWeight: 600,
            textAlign: "center",
            padding: "17px 20px",
            borderRadius: 14,
            textDecoration: "none",
            boxShadow: "0 12px 34px -14px rgba(74,44,90,0.6)",
            animationDelay: "0.58s",
          }}
        >
          Открыть в Telegram
        </a>

        <p
          className="bx-rise"
          style={{
            fontSize: 13,
            lineHeight: 1.55,
            color: "var(--color-v2-ink-400)",
            margin: "22px 0 0",
            animationDelay: "0.72s",
          }}
        >
          Регистрация и согласие на обработку данных проходят в боте.
          <br />
          <span style={{ opacity: 0.85 }}>Roʻyxatdan oʻtish — Telegram botda.</span>
        </p>

        <a
          href={botDeepLink}
          className="bx-rise"
          style={{
            display: "inline-block",
            marginTop: 18,
            fontFamily: "var(--font-v2-mono)",
            fontSize: 13,
            letterSpacing: "0.02em",
            color: "var(--color-v2-accent)",
            textDecoration: "none",
            animationDelay: "0.82s",
          }}
        >
          @{BOT_USERNAME}
        </a>
      </div>
    </main>
  );
}
