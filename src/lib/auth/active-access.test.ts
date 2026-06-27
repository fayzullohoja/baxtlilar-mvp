import { describe, it, expect } from "vitest";
import { isActiveAccessAllowed } from "./active-access";
import { nextScreenFor } from "@/lib/state-machine/router";
import type { DbUser } from "@/lib/auth/current-user";

describe("isActiveAccessAllowed", () => {
  it("active всегда пускается", () => {
    expect(isActiveAccessAllowed("active")).toBe(true);
    expect(isActiveAccessAllowed("active", { allowPaused: true })).toBe(true);
  });

  it("paused пускается ТОЛЬКО при allowPaused", () => {
    expect(isActiveAccessAllowed("paused")).toBe(false);
    expect(isActiveAccessAllowed("paused", { allowPaused: true })).toBe(true);
  });

  it("blocked / deleted / onboarding не пускаются никогда", () => {
    for (const lc of ["blocked", "deleted", "onboarding"] as const) {
      expect(isActiveAccessAllowed(lc)).toBe(false);
      expect(isActiveAccessAllowed(lc, { allowPaused: true })).toBe(false);
    }
  });
});

describe("C1: paused имеет достижимый экран (нет петли редиректов)", () => {
  // Контракт: экран, на который router отправляет paused, ОБЯЗАН пускать paused.
  // Если кто-то изменит nextScreenFor(paused) — этот тест заставит проверить,
  // что новый экран тоже вызывает гард с allowPaused:true.
  it("nextScreenFor(paused) === /main, и /main пускает paused", () => {
    const pausedUser = {
      lifecycle_state: "paused",
      onboarding_step: "active",
    } as unknown as DbUser;
    expect(nextScreenFor(pausedUser)).toBe("/main");
    // /main вызывает requireActiveUser(locale, { allowPaused: true }) → предикат
    // ниже обязан вернуть true, иначе петля.
    expect(isActiveAccessAllowed("paused", { allowPaused: true })).toBe(true);
  });
});
