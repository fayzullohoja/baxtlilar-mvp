import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

// --- Task 10: GET/POST /api/admin/invites -----------------------------------
//
// loadInviteRows и createMasterCode мокаем целиком - каждая уже покрыта
// собственными тестами (load-invites не имеет отдельного файла по образцу
// load-client.ts/load-profile-full.ts, createMasterCode - в store.test.ts).
// Здесь предмет теста - ТОЛЬКО гейт прав и то, что роут честно транслирует
// вход/выход, не подменяя их сам.

const { requireAdminApiMock, adminAuditMock, loadInviteRowsMock, createMasterCodeMock } = vi.hoisted(() => ({
  requireAdminApiMock: vi.fn(),
  adminAuditMock: vi.fn(async () => {}),
  loadInviteRowsMock: vi.fn(),
  createMasterCodeMock: vi.fn(),
}));

vi.mock("@/lib/admin/guard", () => ({
  requireAdminApi: requireAdminApiMock,
  adminAudit: adminAuditMock,
}));
vi.mock("@/lib/admin/load-invites", () => ({ loadInviteRows: loadInviteRowsMock }));
vi.mock("@/lib/invite/store", () => ({ createMasterCode: createMasterCodeMock }));

import { GET, POST } from "./route";

function postReq(body: unknown): NextRequest {
  return new Request("http://localhost/api/admin/invites", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

beforeEach(() => {
  requireAdminApiMock.mockReset();
  requireAdminApiMock.mockResolvedValue({ session: { adminId: "admin-1", role: "superadmin" } });
  adminAuditMock.mockClear();
  loadInviteRowsMock.mockReset();
  loadInviteRowsMock.mockResolvedValue([]);
  createMasterCodeMock.mockReset();
  createMasterCodeMock.mockResolvedValue("ABC123");
});

describe("GET /api/admin/invites (Task 10)", () => {
  it("moderator - 403 forbidden, список не грузит", async () => {
    requireAdminApiMock.mockResolvedValue({ session: { adminId: "m1", role: "moderator" } });
    const res = await GET();

    expect(res.status).toBe(403);
    expect(loadInviteRowsMock).not.toHaveBeenCalled();
  });

  it("superadmin - отдаёт строки как есть", async () => {
    const rows = [{ id: "c1", code: "ABC123" }];
    loadInviteRowsMock.mockResolvedValue(rows);
    const res = await GET();
    const body = (await res.json()) as { ok: boolean; rows: unknown[] };

    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true, rows });
  });
});

describe("POST /api/admin/invites - создание мастер-кода (Task 10)", () => {
  it("moderator - 403 forbidden, код не выпускает", async () => {
    requireAdminApiMock.mockResolvedValue({ session: { adminId: "m1", role: "moderator" } });
    const res = await POST(postReq({ label: "тест" }));

    expect(res.status).toBe(403);
    expect(createMasterCodeMock).not.toHaveBeenCalled();
  });

  it("пустая подпись - 400 label_required, код не выпускает (обязательность из брифа Task 10)", async () => {
    const res = await POST(postReq({ label: "   " }));

    expect(res.status).toBe(400);
    const body = (await res.json()) as { ok: boolean; error: string };
    expect(body).toEqual({ ok: false, error: "label_required" });
    expect(createMasterCodeMock).not.toHaveBeenCalled();
  });

  it("подпись есть - выпускает код и пишет аудит с подписью в reason", async () => {
    const res = await POST(postReq({ label: "Встреча в Ташкенте" }));
    const body = (await res.json()) as { ok: boolean; code: string };

    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true, code: "ABC123" });
    expect(createMasterCodeMock).toHaveBeenCalledWith("Встреча в Ташкенте");
    expect(adminAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "invite_master_code_created", reason: "Встреча в Ташкенте" }),
    );
  });

  it("сбой выпуска - 500 internal, аудит не пишется", async () => {
    createMasterCodeMock.mockRejectedValue(new Error("connection refused"));
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await POST(postReq({ label: "тест" }));
    const body = (await res.json()) as { ok: boolean; error: string };

    expect(res.status).toBe(500);
    expect(body).toEqual({ ok: false, error: "internal" });
    expect(adminAuditMock).not.toHaveBeenCalled();

    errSpy.mockRestore();
  });
});
