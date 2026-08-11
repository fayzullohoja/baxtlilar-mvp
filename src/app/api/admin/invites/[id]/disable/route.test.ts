import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

// --- Task 10: POST /api/admin/invites/[id]/disable --------------------------
//
// requireAdminApi/adminAudit мокаем целиком (не предмет теста). can() берём
// настоящий (invites.manage - чистая lookup-таблица, super получает всё).
// @/lib/invite/store мокаем целиком - disableCodesOfUser уже покрыт своими
// тестами (store.test.ts), здесь важно только КТО и С КАКОЙ причиной его
// зовёт. supabaseAdmin мокаем на select строки кода + (для мастер-кода) update
// самой строки напрямую.

const { requireAdminApiMock, adminAuditMock, disableCodesOfUserMock, fromMock } = vi.hoisted(() => ({
  requireAdminApiMock: vi.fn(),
  adminAuditMock: vi.fn(async () => {}),
  disableCodesOfUserMock: vi.fn(async () => {}),
  fromMock: vi.fn(),
}));

vi.mock("@/lib/admin/guard", () => ({
  requireAdminApi: requireAdminApiMock,
  adminAudit: adminAuditMock,
}));
vi.mock("@/lib/supabase/admin", () => ({ supabaseAdmin: () => ({ from: fromMock }) }));
vi.mock("@/lib/invite/store", () => ({ disableCodesOfUser: disableCodesOfUserMock }));

import { POST } from "./route";

type CodeRow = { id: string; owner_id: string | null; disabled_at: string | null };

let codeRow: CodeRow | null = null;
let updateError: { message: string } | null = null;
const updatedPatches: Array<Record<string, unknown>> = [];

fromMock.mockImplementation((table: string) => {
  if (table !== "invite_codes") throw new Error(`неожиданная таблица в тесте: ${table}`);
  return {
    select: () => ({
      eq: () => ({
        maybeSingle: () => Promise.resolve({ data: codeRow, error: null }),
      }),
    }),
    update: (patch: Record<string, unknown>) => {
      updatedPatches.push(patch);
      return {
        eq: () => ({
          is: () => Promise.resolve({ error: updateError }),
        }),
      };
    },
  };
});

const req = new Request("http://localhost/api/admin/invites/c1/disable", {
  method: "POST",
}) as unknown as NextRequest;

function call(id = "c1") {
  return POST(req, { params: Promise.resolve({ id }) });
}

beforeEach(() => {
  codeRow = { id: "c1", owner_id: "u1", disabled_at: null };
  updateError = null;
  updatedPatches.length = 0;
  requireAdminApiMock.mockReset();
  requireAdminApiMock.mockResolvedValue({ session: { adminId: "admin-1", role: "superadmin" } });
  adminAuditMock.mockClear();
  disableCodesOfUserMock.mockReset();
  disableCodesOfUserMock.mockResolvedValue(undefined);
  fromMock.mockClear();
});

describe("POST /api/admin/invites/[id]/disable (Task 10)", () => {
  it("moderator - 403 forbidden, ничего не гасит (invites.manage - super-only)", async () => {
    requireAdminApiMock.mockResolvedValue({ session: { adminId: "m1", role: "moderator" } });
    const res = await call();

    expect(res.status).toBe(403);
    expect(disableCodesOfUserMock).not.toHaveBeenCalled();
    expect(adminAuditMock).not.toHaveBeenCalled();
  });

  it("персональный код - гасит ЧЕРЕЗ disableCodesOfUser с reason='leak' (не своя копия логики)", async () => {
    const res = await call();
    const body = (await res.json()) as { ok: boolean };

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(disableCodesOfUserMock).toHaveBeenCalledWith("u1", "leak");
    expect(adminAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "invite_code_disabled", entityId: "c1", reason: "leak" }),
    );
  });

  it("мастер-код (owner_id null) - гасит СТРОКУ напрямую, disableCodesOfUser НЕ зовёт", async () => {
    codeRow = { id: "c2", owner_id: null, disabled_at: null };
    const res = await call("c2");
    const body = (await res.json()) as { ok: boolean };

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(disableCodesOfUserMock).not.toHaveBeenCalled();
    expect(updatedPatches[0]).toMatchObject({ disabled_reason: "leak" });
  });

  it("код уже погашен - 409 already_disabled, повторно не гасит", async () => {
    codeRow = { id: "c1", owner_id: "u1", disabled_at: "2026-08-10T00:00:00.000Z" };
    const res = await call();

    expect(res.status).toBe(409);
    expect(disableCodesOfUserMock).not.toHaveBeenCalled();
    expect(adminAuditMock).not.toHaveBeenCalled();
  });

  it("код не найден - 404, аудит не пишется", async () => {
    codeRow = null;
    const res = await call();

    expect(res.status).toBe(404);
    expect(adminAuditMock).not.toHaveBeenCalled();
  });

  // ⛔ Второе предупреждение ревью Task 8: сбой гашения обязан быть ВИДЕН
  // оператору сразу - честный 500, а не "успех" с проглоченным флагом.
  it("сбой disableCodesOfUser - 500 internal, аудит НЕ пишется (не ложный успех)", async () => {
    disableCodesOfUserMock.mockRejectedValue(new Error("connection refused"));
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await call();
    const body = (await res.json()) as { ok: boolean; error: string };

    expect(res.status).toBe(500);
    expect(body).toEqual({ ok: false, error: "internal" });
    expect(adminAuditMock).not.toHaveBeenCalled();
    expect(errSpy).toHaveBeenCalled();

    errSpy.mockRestore();
  });

  it("сбой гашения строки мастер-кода - тоже 500 internal, а не тихий успех", async () => {
    codeRow = { id: "c2", owner_id: null, disabled_at: null };
    updateError = { message: "connection refused" };
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await call("c2");
    const body = (await res.json()) as { ok: boolean; error: string };

    expect(res.status).toBe(500);
    expect(body).toEqual({ ok: false, error: "internal" });
    expect(adminAuditMock).not.toHaveBeenCalled();

    errSpy.mockRestore();
  });
});
