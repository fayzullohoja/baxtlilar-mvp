import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Пределы дублируются в БД (миграция 20260811170000): форму можно обойти
// прямым запросом, поэтому база - последняя линия, а эти константы нужны
// клиенту и роуту, чтобы объяснить человеку правила ДО отправки.
export const FEEDBACK_MAX_BODY = 1000;
export const FEEDBACK_DAILY_LIMIT = 3;

export type CreateFeedbackInput = {
  userId: string;
  rating: number;
  body: string | null;
  screenshotPath: string | null;
  locale: string;
};

export type CreateFeedbackResult =
  // deduplicated - процедура вернула СТАРУЮ запись (двойной тап, ретрай по
  // таймауту, вторая вкладка), а не создала новую. screenshotStored - доехал ли
  // до записи файл ИМЕННО этой отправки. Оба поля нужны вызывающему для
  // действий, а не для отчёта: файл кладётся в бакет до вызова процедуры, и без
  // них роут не знает, снести ли его и что сказать человеку про скриншот.
  | { ok: true; id: string; deduplicated: boolean; screenshotStored: boolean }
  | { ok: false; error: "rate_limited" | "db_failed" };

/**
 * Создание отзыва. Лимит, дедуп и вставка живут внутри процедуры
 * create_feedback - здесь только разбор её ответа.
 *
 * Диапазон оценки НЕ проверяем: это делают и роут (чтобы дать человеку
 * понятный текст), и CHECK в таблице (чтобы не пустить запрос в обход формы).
 * Третья проверка тут добавила бы место, где правила могут разъехаться.
 */
export async function createFeedback(input: CreateFeedbackInput): Promise<CreateFeedbackResult> {
  const { data, error } = await supabaseAdmin().rpc("create_feedback", {
    p_user_id: input.userId,
    p_rating: input.rating,
    p_body: input.body,
    p_screenshot_path: input.screenshotPath,
    p_locale: input.locale,
  });

  // Адаптер не бросает, а возвращает error - без явной проверки сбой базы
  // выглядел бы как успех, и человек получил бы благодарность за отзыв,
  // которого нет. Проверяем error ПЕРЕД разбором data: при сбое data не
  // обязана быть пустой (частичный ответ, остаток от предыдущего вызова),
  // и разбор строки в такой момент выдал бы "успех" на непрошедшей вставке.
  if (error) return { ok: false, error: "db_failed" };

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return { ok: false, error: "db_failed" };
  if (row.limited) return { ok: false, error: "rate_limited" };
  if (!row.feedback_id) return { ok: false, error: "db_failed" };
  return {
    ok: true,
    id: String(row.feedback_id),
    deduplicated: row.deduplicated === true,
    // Своего файла в отправке не было - сохранять и сносить нечего.
    // А вот отсутствие самого столбца (в базе ещё старая версия процедуры -
    // окно выката) читаем как "сохранён": из двух ошибок эта обратимая.
    // Осиротевший файл подметёт removeUserFeedbackScreenshots обходом папки,
    // а снесённый файл, на который ссылается запись, не вернуть ничем -
    // модератор увидит битую картинку вместо доказательства поломки.
    screenshotStored: input.screenshotPath !== null && row.screenshot_stored !== false,
  };
}
