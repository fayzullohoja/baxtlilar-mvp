import "server-only";
import { env } from "@/lib/env";

/**
 * Отправка сообщения пользователю через бота (push-уведомление).
 * Best-effort: при ошибке не бросает (логирует), чтобы не ломать основной поток.
 */
export async function notifyUser(telegramId: number, text: string): Promise<boolean> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${env().TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // без parse_mode: текст модератора идёт как plain — нет HTML-инъекции/поломки доставки (ADM-6/BUG-8)
      body: JSON.stringify({ chat_id: telegramId, text }),
    });
    return res.ok;
  } catch (e) {
    console.error("[notifyUser] failed", e);
    return false;
  }
}
