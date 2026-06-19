import { AutoBootstrap } from "./auto-bootstrap";

export const dynamic = "force-dynamic";

const BOT_USERNAME = process.env.BOT_USERNAME ?? "baxtlilar_uz_bot";

// Универсальная точка входа для анонимного пользователя. Рендерится
// server-side как "открой в Telegram" фолбэк. Если страница открыта внутри
// Telegram WebView и initData есть, AutoBootstrap клиентом сам отправит на
// /api/auth/bootstrap и перенаправит в приложение. Иначе пользователь видит
// кнопку deep-link на бота. Mini-app в браузере НЕ открывается.
export default function OpenInTelegramPage() {
  const botDeepLink = `https://t.me/${BOT_USERNAME}`;
  return (
    <main className="min-h-screen flex items-center justify-center px-5 py-8 bg-baxt-bg">
      <AutoBootstrap />
      <div className="w-full max-w-sm bg-baxt-card border border-baxt-border rounded-3xl shadow-sm p-8 text-center">
        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-baxt-coral flex items-center justify-center text-white text-3xl font-bold shadow-[0_8px_24px_-8px_rgba(226,82,107,0.5)]">
          B
        </div>
        <h1 className="text-2xl font-bold tracking-tight mb-3">Baxtlilar</h1>
        <p className="text-base mb-2">Откройте приложение через Telegram</p>
        <p className="text-base mb-6 text-baxt-muted">Ilovani Telegram orqali oching</p>
        <a
          href={botDeepLink}
          className="block w-full bg-baxt-coral text-white font-semibold py-3 px-4 rounded-2xl shadow-sm hover:opacity-90 transition"
        >
          @{BOT_USERNAME}
        </a>
        <p className="text-[12px] text-baxt-muted mt-5 leading-snug">
          Регистрация и согласие на обработку данных — в боте.
          <br />
          Roʻyxatdan oʻtish — botda.
        </p>
      </div>
    </main>
  );
}
