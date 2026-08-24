import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { WIFE_WORK_VIEW } from "./options";
import { optLabel, optTranslatorFromMessages } from "./option-label";

/**
 * Замечание 7 тестеров family launch: на вопрос о работе супруга после брака
 * женщинам показывали мужские формулировки - в списке ответов стояло «моя
 * жена». Скриншот приложен к разбору.
 *
 * Тест держит зеркальность: у мужчины в ответах фигурирует жена, у женщины -
 * муж, и никогда наоборот.
 */
const LOCALES = ["ru", "uz", "tr", "en"] as const;

function messagesFor(loc: string) {
  const raw = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "messages", `${loc}.json`), "utf8"),
  ) as { Options?: unknown };
  return optTranslatorFromMessages(raw.Options);
}

/** Слова «жена» и «муж» в каждом языке - для проверки, кто упомянут. */
const WIFE_WORDS: Record<string, RegExp> = {
  ru: /жен[аеуы]/i,
  uz: /xotin/i,
  tr: /karım/i,
  en: /\bwife\b/i,
};
const HUSBAND_WORDS: Record<string, RegExp> = {
  ru: /муж(?!чин)/i,
  uz: /\berim/i,
  tr: /kocam/i,
  en: /\bhusband\b/i,
};

describe("вопрос о работе супруга звучит зеркально", () => {
  for (const loc of LOCALES) {
    it(`${loc}: женщина не видит слова «жена» в вариантах ответа`, () => {
      const t = messagesFor(loc);
      const wrong: string[] = [];
      for (const opt of WIFE_WORK_VIEW) {
        const label = optLabel(t, { ...opt, group: "WIFE_WORK_VIEW" }, loc, "f");
        if (WIFE_WORDS[loc].test(label)) wrong.push(`${opt.value}: "${label}"`);
      }
      expect(
        wrong,
        `Женщине показывают вариант про жену - ровно та жалоба тестеров:\n${wrong.join("\n")}`,
      ).toEqual([]);
    });

    it(`${loc}: мужчина не видит слова «муж» в вариантах ответа`, () => {
      const t = messagesFor(loc);
      const wrong: string[] = [];
      for (const opt of WIFE_WORK_VIEW) {
        const label = optLabel(t, { ...opt, group: "WIFE_WORK_VIEW" }, loc, "m");
        if (HUSBAND_WORDS[loc].test(label)) wrong.push(`${opt.value}: "${label}"`);
      }
      expect(wrong, `Мужчине показывают вариант про мужа:\n${wrong.join("\n")}`).toEqual([]);
    });
  }

  it("варианты для мужчины и женщины действительно разные там, где это важно", () => {
    const t = messagesFor("ru");
    for (const value of ["welcome", "prefer_not", "against"]) {
      const opt = WIFE_WORK_VIEW.find((o) => o.value === value)!;
      const m = optLabel(t, { ...opt, group: "WIFE_WORK_VIEW" }, "ru", "m");
      const f = optLabel(t, { ...opt, group: "WIFE_WORK_VIEW" }, "ru", "f");
      expect(m, `вариант ${value} одинаков для М и Ж - зеркальности нет`).not.toBe(f);
    }
  });
});
