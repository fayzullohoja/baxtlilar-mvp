import { describe, it, expect } from "vitest";
import { renderTemplate, type OutboxEventType, type OutboxPayload } from "./tg-outbox-worker";

// Аудит 08.08.2026: в двух RU-шаблонах жил HTML-энтити &nbsp;, а сообщения
// уходят в Telegram БЕЗ parse_mode — юзер видел буквальное «и&nbsp;Вы».
const ALL_EVENTS: OutboxEventType[] = [
  "verification_approved",
  "verification_needs_changes",
  "verification_rejected",
  "tutorial_reminder",
  "mutual_match",
  "new_interest",
  "interest_accepted",
  "new_message",
];

const PAYLOADS: OutboxPayload[] = [
  {},
  { reason: "нечитаемое фото" },
  { reason: "нечитаемое фото", reject_category: "technical" },
  { reason: "не подтвердили личность", reject_category: "blocking" },
];

describe("шаблоны tg_outbox: никакого HTML в тексте без parse_mode", () => {
  it("ни один отрендеренный шаблон не содержит HTML-энтити", () => {
    const bad: string[] = [];
    for (const ev of ALL_EVENTS) {
      for (const locale of ["ru", "uz"] as const) {
        for (const p of PAYLOADS) {
          const text = renderTemplate(ev, p, locale);
          if (/&[a-zA-Z]+;|&#\d+;/.test(text)) bad.push(`${ev}/${locale}: ${text}`);
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it("ни один шаблон не содержит HTML-тегов", () => {
    const bad: string[] = [];
    for (const ev of ALL_EVENTS) {
      for (const locale of ["ru", "uz"] as const) {
        for (const p of PAYLOADS) {
          const text = renderTemplate(ev, p, locale);
          if (/<[a-zA-Z/]/.test(text)) bad.push(`${ev}/${locale}: ${text}`);
        }
      }
    }
    expect(bad).toEqual([]);
  });
});

describe("verification_rejected: текст зависит от категории отказа", () => {
  it("blocking → НЕ предлагает переснять и повторить (повтор запрещён)", () => {
    for (const locale of ["ru", "uz"] as const) {
      const text = renderTemplate("verification_rejected", { reject_category: "blocking" }, locale);
      expect(text).toMatch(/support/i); // ведём в поддержку
      expect(text).not.toMatch(/переснять|qayta suratga/i);
    }
  });

  it("technical → предлагает переснять и попробовать снова", () => {
    const ru = renderTemplate("verification_rejected", { reject_category: "technical" }, "ru");
    expect(ru).toMatch(/переснять/i);
  });
});
