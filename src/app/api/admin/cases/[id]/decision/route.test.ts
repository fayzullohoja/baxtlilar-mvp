import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

// --- Task 8: одобрение верификации должно выпускать код приглашения --------
//
// requireAdminApi мокаем (не предмет теста). validatePassportPayload мокаем
// на "ошибок нет" - правила самой паспортной валидации не относятся к этому
// тесту, важно только поведение approve-ветки ПОСЛЕ успешного RPC.
// supabaseAdmin().rpc мокаем управляемо. @/lib/invite/store мокаем целиком -
// важно только КТО и КОГДА вызывает ensureCodeForUser.

const { requireAdminApiMock, rpcMock, validatePassportPayloadMock, ensureCodeForUserMock } = vi.hoisted(() => ({
  requireAdminApiMock: vi.fn(),
  rpcMock: vi.fn(),
  validatePassportPayloadMock: vi.fn((): { field: string; severity: "block" | "warn"; message: string }[] => []),
  ensureCodeForUserMock: vi.fn(async () => "ABC123"),
}));

vi.mock("@/lib/admin/guard", () => ({ requireAdminApi: requireAdminApiMock }));
vi.mock("@/lib/supabase/admin", () => ({ supabaseAdmin: () => ({ rpc: rpcMock }) }));
vi.mock("@/lib/admin/passport-validation", () => ({ validatePassportPayload: validatePassportPayloadMock }));
vi.mock("@/lib/invite/store", () => ({ ensureCodeForUser: ensureCodeForUserMock }));

import { POST } from "./route";

let approveRpcResult: Record<string, unknown> = { ok: true, identity_id: "i1", user_id: "u1" };

rpcMock.mockImplementation(async () => ({ data: approveRpcResult, error: null }));

function req(body: unknown) {
  return { json: async () => body } as unknown as NextRequest;
}

const approveBody = {
  action: "approve" as const,
  payload: { last_name: "Иванов" },
  expected_updated_at: "2026-08-11T00:00:00.000Z",
};

function call(body: unknown = approveBody) {
  return POST(req(body), { params: Promise.resolve({ id: "case-1" }) });
}

beforeEach(() => {
  approveRpcResult = { ok: true, identity_id: "i1", user_id: "u1" };
  requireAdminApiMock.mockReset();
  requireAdminApiMock.mockResolvedValue({ session: { adminId: "admin-1", role: "superadmin" } });
  rpcMock.mockClear();
  validatePassportPayloadMock.mockReset();
  validatePassportPayloadMock.mockReturnValue([]);
  ensureCodeForUserMock.mockReset();
  ensureCodeForUserMock.mockResolvedValue("ABC123");
});

describe("POST /api/admin/cases/[id]/decision (approve) - выпуск кода приглашения (Task 8)", () => {
  it("успешное одобрение выпускает код приглашённому пользователю по user_id из RPC", async () => {
    const res = await call();
    const body = (await res.json()) as { ok: boolean; user_id: string };

    expect(res.status).toBe(200);
    expect(ensureCodeForUserMock).toHaveBeenCalledWith("u1");
    // Ответ - это в точности то, что вернул RPC: выпуск кода не подменяет и не
    // дополняет тело ответа модератору (сам код видит только сам приглашающий,
    // через GET /api/invite - см. соседний route.test.ts).
    expect(body).toEqual(approveRpcResult);
  });

  it("сбой выпуска кода НЕ отменяет одобрение - ответ остаётся ok:true (подстраховка в GET /api/invite)", async () => {
    ensureCodeForUserMock.mockRejectedValue(new Error("connection refused"));
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await call();
    const body = (await res.json()) as { ok: boolean };

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(errSpy).toHaveBeenCalled();

    errSpy.mockRestore();
  });

  it("RPC вернул ok:false (например stale_case) - ensureCodeForUser НЕ вызывается", async () => {
    // user_id намеренно присутствует ДАЖЕ в отказе: реальный RPC его на error-ветках
    // не отдаёт, и одного этого достаточно, чтобы `if (out.user_id)` не дал вызвать
    // ensureCodeForUser. Но так тест не отличил бы "код не выпустили, потому что
    // проверили out.ok" от "код не выпустили, потому что user_id случайно отсутствовал" -
    // а это ДВЕ РАЗНЫЕ причины. Ставим user_id явно, чтобы единственной причиной
    // отказа осталась именно проверка `!out.ok` в самом route.ts.
    approveRpcResult = { ok: false, error: "stale_case", current_updated_at: "x", user_id: "u1" };
    const res = await call();

    expect(res.status).toBe(409);
    expect(ensureCodeForUserMock).not.toHaveBeenCalled();
  });

  it("валидация паспорта нашла блокер - approve не доходит до RPC/выпуска кода вообще", async () => {
    validatePassportPayloadMock.mockReturnValue([{ field: "last_name", severity: "block", message: "х" }]);
    const res = await call();

    expect(res.status).toBe(400);
    expect(rpcMock).not.toHaveBeenCalled();
    expect(ensureCodeForUserMock).not.toHaveBeenCalled();
  });
});
