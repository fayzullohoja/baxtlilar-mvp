import { AutoBootstrap } from "./auto-bootstrap";

export const dynamic = "force-dynamic";

const BOT_USERNAME = process.env.BOT_USERNAME ?? "baxtlilar_uz_bot";

// Точка входа для анонимного пользователя. Внутри TG WebView AutoBootstrap сам
// авторизует и редиректит; в обычном браузере (mini-app там не открыть) —
// показываем этот брендовый лендинг с deep-link на бота. V2 Editorial Premium:
// тёплая бумага, serif-masthead, один аметистовый акцент, максимум сдержанности.
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
      <AutoBootstrap />

      <div style={{ width: "100%", maxWidth: 400 }}>
        <div
          className="uppercase"
          style={{
            fontFamily: "var(--font-v2-mono)",
            fontSize: 11,
            letterSpacing: "0.2em",
            color: "var(--color-v2-ink-400)",
            marginBottom: 24,
          }}
        >
          Серьёзные знакомства
        </div>

        <h1
          style={{
            fontFamily: "var(--font-v2-display)",
            fontSize: 54,
            lineHeight: 1,
            letterSpacing: "-0.02em",
            fontWeight: 400,
            margin: 0,
            color: "var(--color-v2-ink-100)",
          }}
        >
          Baxtlilar
        </h1>

        {/* Signature: одиночный аметистовый штрих-мачта под словесным знаком. */}
        <div
          aria-hidden
          style={{
            width: 56,
            height: 2,
            background: "var(--color-v2-accent)",
            margin: "22px 0 24px",
          }}
        />

        <p
          style={{
            fontFamily: "var(--font-v2-display)",
            fontSize: 22,
            lineHeight: 1.35,
            fontWeight: 400,
            color: "var(--color-v2-ink-300)",
            margin: "0 0 40px",
            maxWidth: 300,
          }}
        >
          Здесь знакомятся, чтобы создать семью.
        </p>

        <a
          href={botDeepLink}
          className="block transition-opacity active:opacity-90"
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
          }}
        >
          Открыть в Telegram
        </a>

        <p
          style={{
            fontSize: 13,
            lineHeight: 1.55,
            color: "var(--color-v2-ink-400)",
            margin: "22px 0 0",
          }}
        >
          Регистрация и согласие на обработку данных проходят в боте.
          <br />
          <span style={{ opacity: 0.85 }}>Roʻyxatdan oʻtish — Telegram botda.</span>
        </p>

        <a
          href={botDeepLink}
          style={{
            display: "inline-block",
            marginTop: 18,
            fontFamily: "var(--font-v2-mono)",
            fontSize: 13,
            letterSpacing: "0.02em",
            color: "var(--color-v2-accent)",
            textDecoration: "none",
          }}
        >
          @{BOT_USERNAME}
        </a>
      </div>
    </main>
  );
}
