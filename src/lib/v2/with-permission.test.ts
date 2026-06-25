import { describe, it, expect, vi, beforeEach } from "vitest";
import type { DbUser } from "@/lib/auth/current-user";

// Мокаем getCurrentUser до импорта тестируемого модуля.
vi.mock("@/lib/auth/current-user", () => ({
  getCurrentUser: vi.fn(),
}));

import { getCurrentUser } from "@/lib/auth/current-user";
import {
  requirePermissionForRequest,
  requireAllPermissionsForRequest,
} from "./with-permission";

function user(overrides: Partial<DbUser> = {}): DbUser {
  return {
    id: "u-1",
    telegram_id: 1,
    telegram_username: null,
    telegram_first_name: null,
    phone_number: null,
    phone_verified: true,
    language: "ru",
    lifecycle_state: "active",
    onboarding_step: "active",
    verification_status: "approved",
    profile_completion: "completed",
    quiz_completion: "completed",
    blocked_reason: null,
    verification_submitted_at: null,
    tutorial_seen_at: null,
    updated_at: "2026-06-26T00:00:00Z",
    ...overrides,
  };
}

beforeEach(() => {
  vi.mocked(getCurrentUser).mockReset();
});

describe("requirePermissionForRequest", () => {
  it("нет сессии → 401 no_session", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const gate = await requirePermissionForRequest("send_interest");
    expect("response" in gate).toBe(true);
    if ("response" in gate) {
      expect(gate.response.status).toBe(401);
      const body = await gate.response.json();
      expect(body.error).toBe("no_session");
    }
  });

  it("verified + send_interest → пропускает", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(user());
    const gate = await requirePermissionForRequest("send_interest");
    expect("user" in gate).toBe(true);
    if ("user" in gate) {
      expect(gate.role).toBe("verified");
      expect(gate.user.id).toBe("u-1");
    }
  });

  it("shadow + send_interest → 403 permission_denied", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(
      user({ lifecycle_state: "active", verification_status: "pending_review" }),
    );
    const gate = await requirePermissionForRequest("send_interest");
    expect("response" in gate).toBe(true);
    if ("response" in gate) {
      expect(gate.response.status).toBe(403);
      const body = await gate.response.json();
      expect(body.error).toBe("permission_denied");
      expect(body.role).toBe("shadow");
      expect(body.required).toBe("send_interest");
    }
  });

  it("shadow + view_own_profile → пропускает (shadow имеет это право)", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(
      user({ verification_status: "pending_review" }),
    );
    const gate = await requirePermissionForRequest("view_own_profile");
    expect("user" in gate).toBe(true);
    if ("user" in gate) expect(gate.role).toBe("shadow");
  });

  it("deleted user → 403 deleted (специальный код)", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(
      user({ lifecycle_state: "deleted" }),
    );
    const gate = await requirePermissionForRequest("delete_account");
    expect("response" in gate).toBe(true);
    if ("response" in gate) {
      expect(gate.response.status).toBe(403);
      const body = await gate.response.json();
      expect(body.error).toBe("deleted");
    }
  });

  it("blocked + view_feed → 403 blocked (специальный код)", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(
      user({ lifecycle_state: "blocked" }),
    );
    const gate = await requirePermissionForRequest("view_feed");
    expect("response" in gate).toBe(true);
    if ("response" in gate) {
      expect(gate.response.status).toBe(403);
      const body = await gate.response.json();
      expect(body.error).toBe("blocked");
    }
  });

  it("blocked + delete_account → пропускает (GDPR floor)", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(
      user({ lifecycle_state: "blocked" }),
    );
    const gate = await requirePermissionForRequest("delete_account");
    expect("user" in gate).toBe(true);
    if ("user" in gate) expect(gate.role).toBe("blocked");
  });

  it("paused + send_message → пропускает (V2 Sprint 5 расширение для существующих чатов)", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(user({ lifecycle_state: "paused" }));
    const gate = await requirePermissionForRequest("send_message");
    expect("user" in gate).toBe(true);
  });

  it("paused + send_interest → 403 (paused не может слать новые интересы)", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(user({ lifecycle_state: "paused" }));
    const gate = await requirePermissionForRequest("send_interest");
    expect("response" in gate).toBe(true);
  });

  it("rejected + view_own_profile → пропускает (read-only)", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(
      user({ lifecycle_state: "active", verification_status: "rejected" }),
    );
    const gate = await requirePermissionForRequest("view_own_profile");
    expect("user" in gate).toBe(true);
    if ("user" in gate) expect(gate.role).toBe("rejected");
  });

  it("rejected + edit_own_profile → 403 (rejected — read-only)", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(
      user({ lifecycle_state: "active", verification_status: "rejected" }),
    );
    const gate = await requirePermissionForRequest("edit_own_profile");
    expect("response" in gate).toBe(true);
  });
});

describe("requireAllPermissionsForRequest", () => {
  it("все permissions есть → пропускает", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(user());
    const gate = await requireAllPermissionsForRequest(["view_feed", "send_interest"]);
    expect("user" in gate).toBe(true);
  });

  it("первое permission падает → возвращает первый response (fail-fast)", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(
      user({ verification_status: "pending_review" }),
    );
    const gate = await requireAllPermissionsForRequest(["view_feed", "send_interest"]);
    expect("response" in gate).toBe(true);
    if ("response" in gate) {
      const body = await gate.response.json();
      expect(body.required).toBe("view_feed"); // первое, не send_interest
    }
  });

  it("пустой permissions → 500 no_permissions_specified (програм ошибка)", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(user());
    const gate = await requireAllPermissionsForRequest([]);
    expect("response" in gate).toBe(true);
    if ("response" in gate) {
      expect(gate.response.status).toBe(500);
      const body = await gate.response.json();
      expect(body.error).toBe("no_permissions_specified");
    }
  });
});
