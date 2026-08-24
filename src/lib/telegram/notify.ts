import "server-only";
import { env } from "@/lib/env";

/**
 * Отправка сообщения пользователю через бота (push-уведомление).
 * Best-effort: при ошибке не бросает (логирует), чтобы не ломать основной поток.
 * Принимает nullable id: после F-012 erase_user обнуляет telegram_id у
 * удалённых пользователей, и любой вызов с null'ом тихо отказывается.
 */
export async function notifyUser(
  telegramId: number | null | undefined,
  text: string,
): Promise<boolean> {
  if (!telegramId) return false;
  try {
    const res = await fetch(`https://api.telegram.org/bot${env().TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // без parse_mode: текст модератора идёт как plain — нет HTML-инъекции/поломки доставки (ADM-6/BUG-8)
      body: JSON.stringify({ chat_id: telegramId, text }),
      // Тот же таймаут, что в bot-api.ts и tg-outbox-worker.ts. Эта функция
      // зовётся из админских роутов синхронно: без него зависший вызов к
      // Telegram держит модератора на спиннере после нажатия решения.
      signal: AbortSignal.timeout(10_000),
    });
    return res.ok;
  } catch (e) {
    console.error("[notifyUser] failed", e);
    return false;
  }
}
