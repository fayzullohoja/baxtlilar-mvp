import { describe, it, expect } from "vitest";
import { ALLOWED_TRANSITIONS, ALL_STEPS } from "./types";

describe("шаг кода приглашения", () => {
  it("bot_invite_code существует как шаг", () => {
    expect(ALL_STEPS).toContain("bot_invite_code");
  });

  // Шлагбаум ОПУЩЕН: язык -> код.
  it("из языка можно пойти на шаг кода", () => {
    expect(ALLOWED_TRANSITIONS.bot_language).toContain("bot_invite_code");
  });

  // Шлагбаум ПОДНЯТ: язык -> сразу оферта. Обе стрелки разрешены всегда,
  // выбор делает бот по флагу - поэтому переключение не требует деплоя.
  it("из языка по-прежнему можно пойти сразу на оферту", () => {
    expect(ALLOWED_TRANSITIONS.bot_language).toContain("bot_consent_pd");
  });

  it("после кода идёт оферта и только она", () => {
    expect(ALLOWED_TRANSITIONS.bot_invite_code).toEqual(["bot_consent_pd"]);
  });

  it("шаг кода не ведёт назад в язык - иначе можно зациклиться", () => {
    expect(ALLOWED_TRANSITIONS.bot_invite_code).not.toContain("bot_language");
  });
});
