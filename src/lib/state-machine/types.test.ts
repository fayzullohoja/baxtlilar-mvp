import { describe, it, expect } from "vitest";
import { ALLOWED_TRANSITIONS, ALL_STEPS } from "./types";

describe("ALLOWED_TRANSITIONS", () => {
  it("покрывает все шаги как источник", () => {
    for (const step of ALL_STEPS) {
      expect(ALLOWED_TRANSITIONS).toHaveProperty(step);
    }
  });

  it("все целевые шаги — валидные", () => {
    for (const [, targets] of Object.entries(ALLOWED_TRANSITIONS)) {
      for (const t of targets) expect(ALL_STEPS).toContain(t);
    }
  });

  it("нет self-loops", () => {
    for (const [src, targets] of Object.entries(ALLOWED_TRANSITIONS)) {
      expect(targets).not.toContain(src as (typeof ALL_STEPS)[number]);
    }
  });

  it("MVP-порядок: телефон перед документами", () => {
    expect(ALLOWED_TRANSITIONS.consent).toContain("phone_input");
    expect(ALLOWED_TRANSITIONS.otp_pending).toContain("doc_upload");
    expect(ALLOWED_TRANSITIONS.doc_upload).toContain("selfie_upload");
    expect(ALLOWED_TRANSITIONS.selfie_upload).toContain("moderation_pending");
  });

  it("модератор может одобрить или вернуть с moderation_pending", () => {
    expect(ALLOWED_TRANSITIONS.moderation_pending).toEqual(
      expect.arrayContaining(["profile_basic", "needs_changes", "verification_rejected"]),
    );
  });

  it("active — терминальный (для onboarding-цикла)", () => {
    expect(ALLOWED_TRANSITIONS.active).toEqual([]);
  });
});
