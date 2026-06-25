import { describe, it, expect } from "vitest";
import {
  deriveRole,
  hasPermission,
  ROLE_PERMISSIONS,
  type Role,
} from "./permissions";

describe("deriveRole", () => {
  it("lifecycle=onboarding → 'onboarding' независимо от verification_status", () => {
    expect(deriveRole("onboarding", "not_started")).toBe("onboarding");
    expect(deriveRole("onboarding", "approved")).toBe("onboarding");
    expect(deriveRole("onboarding", "rejected")).toBe("onboarding");
  });

  it("lifecycle=active + verification=approved → 'verified'", () => {
    expect(deriveRole("active", "approved")).toBe("verified");
  });

  it("lifecycle=active + verification=rejected → 'rejected'", () => {
    expect(deriveRole("active", "rejected")).toBe("rejected");
  });

  it("Shadow Active: lifecycle=active + verification ∈ {submitted, pending, needs_changes, not_started}", () => {
    expect(deriveRole("active", "documents_uploaded")).toBe("shadow");
    expect(deriveRole("active", "liveness_uploaded")).toBe("shadow");
    expect(deriveRole("active", "pending_review")).toBe("shadow");
    expect(deriveRole("active", "needs_changes")).toBe("shadow");
    expect(deriveRole("active", "not_started")).toBe("shadow");
    expect(deriveRole("active", "phone_verified")).toBe("shadow");
  });

  it("lifecycle ∈ {paused, blocked, deleted} побеждает verification_status", () => {
    expect(deriveRole("paused", "approved")).toBe("paused");
    expect(deriveRole("blocked", "approved")).toBe("blocked");
    expect(deriveRole("deleted", "approved")).toBe("deleted");
  });
});

describe("ROLE_PERMISSIONS — fail-closed gate matrix", () => {
  it("shadow НЕ может смотреть feed, быть видимым, отправлять/получать интересы, открывать чаты", () => {
    const denied = [
      "view_feed",
      "be_visible_in_feed",
      "send_interest",
      "receive_interest",
      "view_received_interests",
      "open_chat",
      "send_message",
    ] as const;
    for (const p of denied) expect(hasPermission("shadow", p)).toBe(false);
  });

  it("shadow МОЖЕТ смотреть/править свою анкету и delete аккаунт", () => {
    expect(hasPermission("shadow", "view_own_profile")).toBe(true);
    expect(hasPermission("shadow", "edit_own_profile")).toBe(true);
    expect(hasPermission("shadow", "delete_account")).toBe(true);
  });

  it("verified имеет все matching/чат права", () => {
    const required = [
      "view_feed",
      "be_visible_in_feed",
      "send_interest",
      "receive_interest",
      "open_chat",
      "send_message",
      "view_chat_list",
    ] as const;
    for (const p of required) expect(hasPermission("verified", p)).toBe(true);
  });

  it("rejected — read-only (нет view_feed, нет edit_own_profile)", () => {
    expect(hasPermission("rejected", "view_feed")).toBe(false);
    expect(hasPermission("rejected", "edit_own_profile")).toBe(false);
    expect(hasPermission("rejected", "view_own_profile")).toBe(true);
    expect(hasPermission("rejected", "delete_account")).toBe(true);
  });

  it("blocked сохраняет только delete + export (GDPR floor)", () => {
    expect(ROLE_PERMISSIONS.blocked).toEqual(
      expect.arrayContaining(["delete_account", "export_account"]),
    );
    expect(hasPermission("blocked", "view_feed")).toBe(false);
    expect(hasPermission("blocked", "view_own_profile")).toBe(false);
  });

  it("deleted — пустой permission set", () => {
    expect(ROLE_PERMISSIONS.deleted).toEqual([]);
  });

  it("paused → нет send_interest/be_visible, есть существующие чаты + safety", () => {
    expect(hasPermission("paused", "send_interest")).toBe(false);
    expect(hasPermission("paused", "be_visible_in_feed")).toBe(false);
    expect(hasPermission("paused", "view_chat_list")).toBe(true);
    expect(hasPermission("paused", "open_chat")).toBe(true);
    expect(hasPermission("paused", "send_message")).toBe(true);
    expect(hasPermission("paused", "block_user")).toBe(true);
    expect(hasPermission("paused", "report_user")).toBe(true);
    expect(hasPermission("paused", "resume_account")).toBe(true);
  });
});

describe("Permission matrix invariants", () => {
  const ALL_ROLES: Role[] = [
    "guest",
    "onboarding",
    "shadow",
    "verified",
    "rejected",
    "paused",
    "blocked",
    "deleted",
  ];

  it("каждая роль покрыта в ROLE_PERMISSIONS", () => {
    for (const r of ALL_ROLES) expect(ROLE_PERMISSIONS).toHaveProperty(r);
  });

  it("только verified получает send_interest (главный fail-closed инвариант)", () => {
    const granted = ALL_ROLES.filter((r) => hasPermission(r, "send_interest"));
    expect(granted).toEqual(["verified"]);
  });

  it("только verified виден в feed (Shadow Active core constraint)", () => {
    const granted = ALL_ROLES.filter((r) => hasPermission(r, "be_visible_in_feed"));
    expect(granted).toEqual(["verified"]);
  });

  it("send_message — verified + paused (existing chats), не shadow/rejected/blocked", () => {
    const granted = ALL_ROLES.filter((r) => hasPermission(r, "send_message"));
    expect(granted).toEqual(["verified", "paused"]);
  });

  it("block_user / report_user — verified + paused (safety floor), не shadow", () => {
    const blockers = ALL_ROLES.filter((r) => hasPermission(r, "block_user"));
    const reporters = ALL_ROLES.filter((r) => hasPermission(r, "report_user"));
    expect(blockers).toEqual(["verified", "paused"]);
    expect(reporters).toEqual(["verified", "paused"]);
  });
});
