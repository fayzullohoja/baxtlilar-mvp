import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

// --- Task 10: POST /api/admin/invites/[id]/restore --------------------------
//
// Симметрично disable/route.test.ts. restoreInviteRight мокаем целиком (уже
// покрыт store.test.ts) - здесь важны ТОЛЬКО гейты: кому можно, какую строку
// можно восстанавливать (owner_id есть, disabled_reason === "leak").

const { requireAdminApiMock, adminAuditMock, restoreInviteRightMock, fromMock } = vi.hoisted(() => ({
  requireAdminApiMock: vi.fn(),
  adminAuditMock: vi.fn(async () => {}),
  restoreInviteRightMock: vi.fn(async () => {}),
  fromMock: vi.fn(),
}));

vi.mock("@/lib/admin/guard", () => ({
  requireAdminApi: requireAdminApiMock,
  adminAudit: adminAuditMock,
}));
vi.mock("@/lib/supabase/admin", () => ({ supabaseAdmin: () => ({ from: fromMock }) }));
vi.mock("@/lib/invite/store", () => ({ restoreInviteRight: restoreInviteRightMock }));

import { POST } from "./route";

type CodeRow = { id: string; owner_id: string | null; disabled_reason: string | null };

let codeRow: CodeRow | null = null;

fromMock.mockImplementation((table: string) => {
  if (table !== "invite_codes") throw new Error(`неожиданная таблица в тесте: ${table}`);
  return {
    select: () => ({
      eq: () => ({
        maybeSingle: () => Promise.resolve({ data: codeRow, error: null }),
      }),
    }),
  };
});

const req = new Request("http://localhost/api/admin/invites/c1/restore", {
  method: "POST",
}) as unknown as NextRequest;

function call(id = "c1") {
  return POST(req, { params: Promise.resolve({ id }) });
}

beforeEach(() => {
  codeRow = { id: "c1", owner_id: "u1", disabled_reason: "leak" };
  requireAdminApiMock.mockReset();
  requireAdminApiMock.mockResolvedValue({ session: { adminId: "admin-1", role: "superadmin" } });
  adminAuditMock.mockClear();
  restoreInviteRightMock.mockReset();
  restoreInviteRightMock.mockResolvedValue(undefined);
  fromMock.mockClear();
});

describe("POST /api/admin/invites/[id]/restore (Task 10)", () => {
  it("moderator - 403 forbidden", async () => {
    requireAdminApiMock.mockResolvedValue({ session: { adminId: "m1", role: "moderator" } });
    const res = await call();

    expect(res.status).toBe(403);
    expect(restoreInviteRightMock).not.toHaveBeenCalled();
  });

  it("код погашен за утечку - снимает запрет ВЛАДЕЛЬЦА (не самой строки)", async () => {
    const res = await call();
    const body = (await res.json()) as { ok: boolean };

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(restoreInviteRightMock).toHaveBeenCalledWith("u1");
    expect(adminAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "invite_right_restored", entity: "user", entityId: "u1" }),
    );
  });

  it("мастер-код (owner_id null) - 400 no_owner, restoreInviteRight НЕ зовёт", async () => {
    codeRow = { id: "c2", owner_id: null, disabled_reason: "leak" };
    const res = await call("c2");

    expect(res.status).toBe(400);
    expect(restoreInviteRightMock).not.toHaveBeenCalled();
  });

  // Симметрично фильтру disabled_reason='ban' в reviveBanDisabledCodes (Task
  // 8): снимать этой кнопкой можно ТОЛЬКО то, что ЕЮ ЖЕ и погашено.
  it("код погашен НЕ за утечку (напр. бан) - 409 not_leak, право не трогает", async () => {
    codeRow = { id: "c1", owner_id: "u1", disabled_reason: "ban" };
    const res = await call();

    expect(res.status).toBe(409);
    expect(restoreInviteRightMock).not.toHaveBeenCalled();
  });

  it("код не найден - 404", async () => {
    codeRow = null;
    const res = await call();

    expect(res.status).toBe(404);
    expect(restoreInviteRightMock).not.toHaveBeenCalled();
  });

  it("сбой restoreInviteRight - 500 internal, аудит не пишется (видимый провал, не тихий успех)", async () => {
    restoreInviteRightMock.mockRejectedValue(new Error("connection refused"));
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await call();
    const body = (await res.json()) as { ok: boolean; error: string };

    expect(res.status).toBe(500);
    expect(body).toEqual({ ok: false, error: "internal" });
    expect(adminAuditMock).not.toHaveBeenCalled();

    errSpy.mockRestore();
  });
});
