import { describe, it, expect } from "vitest";
import { renderTemplate, type OutboxEventType, type OutboxPayload } from "./tg-outbox-worker";

describe("renderTemplate — verification_approved", () => {
  it("RU template", () => {
    const t = renderTemplate("verification_approved", {}, "ru");
    expect(t).toMatch(/Профиль одобрен/);
    expect(t).toMatch(/Baxtlilar/);
  });
  it("UZ template", () => {
    const t = renderTemplate("verification_approved", {}, "uz");
    expect(t).toMatch(/tasdiqlandi/);
  });
});

describe("renderTemplate — verification_needs_changes", () => {
  it("RU без reason — общий текст", () => {
    const t = renderTemplate("verification_needs_changes", {}, "ru");
    expect(t).toMatch(/уточнить/);
    expect(t).not.toMatch(/Причина:/);
  });
  it("RU с reason — добавляется к тексту", () => {
    const t = renderTemplate(
      "verification_needs_changes",
      { reason: "плохое селфи" },
      "ru",
    );
    expect(t).toMatch(/уточнить/);
    expect(t).toMatch(/Причина: плохое селфи/);
  });
  it("UZ с reason", () => {
    const t = renderTemplate(
      "verification_needs_changes",
      { reason: "yaxshi rasm emas" },
      "uz",
    );
    expect(t).toMatch(/Sabab: yaxshi rasm emas/);
  });
});

describe("renderTemplate — verification_rejected", () => {
  it("RU blocking — soft, без призыва к retry", () => {
    const t = renderTemplate(
      "verification_rejected",
      { reject_category: "blocking" },
      "ru",
    );
    expect(t).toMatch(/не смогли подтвердить/);
    expect(t).toMatch(/baxtlilar_support/);
    expect(t).not.toMatch(/попробуй/i);
  });

  it("RU technical — есть призыв переснять", () => {
    const t = renderTemplate(
      "verification_rejected",
      { reject_category: "technical" },
      "ru",
    );
    expect(t).toMatch(/переснять/);
    expect(t).toMatch(/попробуй ещё раз/i);
  });

  it("UZ blocking — soft", () => {
    const t = renderTemplate(
      "verification_rejected",
      { reject_category: "blocking" },
      "uz",
    );
    expect(t).toMatch(/tasdiqlay olmadik/);
    expect(t).toMatch(/baxtlilar_support/);
  });
});

describe("renderTemplate — tutorial_reminder", () => {
  it("RU + UZ", () => {
    expect(renderTemplate("tutorial_reminder", {}, "ru")).toMatch(/знакомство с приложением/);
    expect(renderTemplate("tutorial_reminder", {}, "uz")).toMatch(/Ilova bilan tanishish/);
  });
});

describe("renderTemplate — coverage matrix", () => {
  const EVENTS: OutboxEventType[] = [
    "verification_approved",
    "verification_needs_changes",
    "verification_rejected",
    "tutorial_reminder",
  ];
  const LOCALES: Array<"ru" | "uz"> = ["ru", "uz"];

  it("каждый event × locale возвращает non-empty string", () => {
    for (const e of EVENTS) {
      for (const l of LOCALES) {
        const payload: OutboxPayload = e === "verification_rejected" ? { reject_category: "technical" } : {};
        const t = renderTemplate(e, payload, l);
        expect(t.length).toBeGreaterThan(20);
      }
    }
  });

  it("RU и UZ возвращают РАЗНЫЕ строки (i18n работает)", () => {
    for (const e of EVENTS) {
      const payload: OutboxPayload = e === "verification_rejected" ? { reject_category: "technical" } : {};
      const ru = renderTemplate(e, payload, "ru");
      const uz = renderTemplate(e, payload, "uz");
      expect(ru).not.toBe(uz);
    }
  });
});
