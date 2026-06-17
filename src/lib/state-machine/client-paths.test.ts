import { describe, it, expect } from "vitest";
import { clientNextPath, CLIENT_ONBOARDING_PATHS } from "./client-paths";
import { ONBOARDING_PATHS } from "./router";

describe("clientNextPath", () => {
  it("blocked → /blocked", () => {
    expect(clientNextPath("blocked", "active")).toBe("/blocked");
  });

  it("active / paused → /main", () => {
    expect(clientNextPath("active", "active")).toBe("/main");
    expect(clientNextPath("paused", "active")).toBe("/main");
  });

  it("deleted → / (NOT /main — must match server nextScreenFor, else redirect loop)", () => {
    expect(clientNextPath("deleted", "active")).toBe("/");
    expect(clientNextPath("deleted", "consent")).toBe("/");
  });

  it("onboarding → step path", () => {
    expect(clientNextPath("onboarding", "consent")).toBe("/onboarding/consent");
    expect(clientNextPath("onboarding", "phone_input")).toBe("/onboarding/phone");
    expect(clientNextPath("onboarding", "active")).toBe("/main");
  });

  it("unknown step → /", () => {
    expect(clientNextPath("onboarding", "bogus_step")).toBe("/");
  });
});

describe("routing map parity (no client/server drift)", () => {
  it("CLIENT_ONBOARDING_PATHS equals server ONBOARDING_PATHS", () => {
    // Эти две карты — копии (client-only vs server). Тест валит сборку при дрейфе,
    // который и породил баг с петлёй редиректов у deleted-юзера.
    expect(CLIENT_ONBOARDING_PATHS).toEqual(ONBOARDING_PATHS);
  });
});
