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

  it("deleted → /deleted (терминал; раньше '/' давал петлю редиректов — C4)", () => {
    expect(clientNextPath("deleted", "active")).toBe("/deleted");
    expect(clientNextPath("deleted", "consent")).toBe("/deleted");
  });

  it("onboarding → step path (V2 Sprint 8: verification переехало на /v2/verify)", () => {
    expect(clientNextPath("onboarding", "verification_intro")).toBe("/v2/verify/intro");
    expect(clientNextPath("onboarding", "doc_upload")).toBe("/v2/verify/doc");
    expect(clientNextPath("onboarding", "selfie_upload")).toBe("/v2/verify/selfie");
    expect(clientNextPath("onboarding", "active")).toBe("/main");
  });

  it("bot-шаги и legacy SMS-шаги ведут на /open-in-telegram", () => {
    expect(clientNextPath("onboarding", "bot_language")).toBe("/open-in-telegram");
    expect(clientNextPath("onboarding", "bot_contact")).toBe("/open-in-telegram");
    expect(clientNextPath("onboarding", "bot_consent_pd")).toBe("/open-in-telegram");
    expect(clientNextPath("onboarding", "bot_consent_biometric")).toBe("/open-in-telegram");
    expect(clientNextPath("onboarding", "consent")).toBe("/open-in-telegram");
    expect(clientNextPath("onboarding", "phone_input")).toBe("/open-in-telegram");
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
