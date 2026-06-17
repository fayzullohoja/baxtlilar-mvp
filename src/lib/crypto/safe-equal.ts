import "server-only";
import crypto from "node:crypto";

/**
 * Сравнение двух строк (обычно base64url HMAC-подписей) в ПОСТОЯННОМ времени.
 *
 * Зачем: проверка подписи cookie-сессии идёт на КАЖДЫЙ запрос. Обычный `!==`
 * сравнивает побайтно с ранним выходом — теоретически утечка ожидаемой подписи по
 * таймингу. `crypto.timingSafeEqual` снимает этот канал. Длину сравниваем заранее
 * (она не секретна, и timingSafeEqual бросает на разной длине буферов).
 *
 * Тот же подход уже используется в `verifyStorageSig` (подписанные ссылки на файлы);
 * хелпер выравнивает поведение сессий с этим стандартом.
 */
export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}
