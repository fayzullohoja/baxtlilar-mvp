import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Стережёт текст об исчерпанном лимите отзывов от календарных слов.
 *
 * Лимит считается скользящим окном: create_feedback (миграция
 * supabase/migrations/20260811170000_feedback.sql) берёт записи с
 * created_at > now() - interval '24 hours'. Слова «сегодня» и «завтра»
 * доопределяют поведение, которого нет: человек, оставивший три отзыва в 23:30,
 * приходит утром «завтра» и получает ровно тот же отказ с тем же советом
 * подождать до завтра - и так по кругу. Поэтому текст говорит про последние
 * сутки и «попробуйте позже», а тест валит сборку, если календарные слова
 * вернутся.
 *
 * Локали перечислены руками, а не выведены из parity-теста: messages-parity
 * сверяет только ru и uz, en и tr в него не входят, и уехавший текст там
 * прошёл бы незамеченным.
 */
const CALENDAR_WORDS: Record<string, string[]> = {
  ru: ["сегодня", "завтра"],
  uz: ["bugun", "ertaga"],
  en: ["today", "tomorrow"],
  tr: ["bugün", "yarın"],
};

function rateLimitCopy(locale: string): string {
  const raw = readFileSync(join(process.cwd(), "messages", `${locale}.json`), "utf8");
  const dict = JSON.parse(raw) as { Feedback?: Record<string, string> };
  return dict.Feedback?.err_rate_limited ?? "";
}

describe("Feedback.err_rate_limited", () => {
  for (const [locale, words] of Object.entries(CALENDAR_WORDS)) {
    it(`${locale}: не обещает календарный день`, () => {
      const copy = rateLimitCopy(locale).toLowerCase();
      expect(copy).not.toBe("");
      expect(words.filter((w) => copy.includes(w))).toEqual([]);
    });
  }
});
