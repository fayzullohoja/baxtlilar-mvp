import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

// --- Task 8: успешный разбан должен оживлять коды, погашенные баном --------
//
// requireAdminApi/adminAudit мокаем целиком (это авторизация и аудит - не
// предмет этого теста), can() берём настоящий (чистая lookup-таблица, роль
// superadmin даёт users.sanction). supabaseAdmin мокаем на 2 вызова к
// таблице users (select текущего состояния + update pending_ban_prev_lifecycle),
// tryTransition мокаем управляемо. @/lib/invite/store мокаем целиком - важно
// только КТО и КОГДА вызывает reviveBanDisabledCodes.

const { requireAdminApiMock, adminAuditMock, tryTransitionMock, reviveBanDisabledCodesMock, fromMock } =
  vi.hoisted(() => ({
    requireAdminApiMock: vi.fn(),
    adminAuditMock: vi.fn(async () => {}),
    tryTransitionMock: vi.fn(),
    reviveBanDisabledCodesMock: vi.fn(async () => {}),
    fromMock: vi.fn(),
  }));

vi.mock("@/lib/admin/guard", () => ({
  requireAdminApi: requireAdminApiMock,
  adminAudit: adminAuditMock,
}));
vi.mock("@/lib/supabase/admin", () => ({ supabaseAdmin: () => ({ from: fromMock }) }));
vi.mock("@/lib/state-machine/transitions", () => ({ tryTransition: tryTransitionMock }));
vi.mock("@/lib/invite/store", () => ({ reviveBanDisabledCodes: reviveBanDisabledCodesMock }));

import { POST } from "./route";

type UsersRow = {
  profile_completion: string;
  lifecycle_state: string;
  pending_ban_prev_lifecycle: string | null;
};

let userRow: UsersRow | null = null;

fromMock.mockImplementation((table: string) => {
  if (table !== "users") throw new Error(`неожиданная таблица в тесте: ${table}`);
  return {
    select: () => ({
      eq: () => ({
        maybeSingle: () => Promise.resolve({ data: userRow, error: null }),
      }),
    }),
    update: () => ({
      eq: () => Promise.resolve({ error: null }),
    }),
  };
});

const req = new Request("http://localhost/api/admin/users/u1/unban", {
  method: "POST",
}) as unknown as NextRequest;

function call(id = "u1") {
  return POST(req, { params: Promise.resolve({ id }) });
}

beforeEach(() => {
  userRow = { profile_completion: "completed", lifecycle_state: "blocked", pending_ban_prev_lifecycle: null };
  requireAdminApiMock.mockReset();
  requireAdminApiMock.mockResolvedValue({ session: { adminId: "admin-1", role: "superadmin" } });
  adminAuditMock.mockClear();
  tryTransitionMock.mockReset();
  tryTransitionMock.mockResolvedValue({ ok: true });
  reviveBanDisabledCodesMock.mockReset();
  reviveBanDisabledCodesMock.mockResolvedValue(undefined);
  fromMock.mockClear();
});

describe("POST /api/admin/users/[id]/unban - оживление кода приглашения (Task 8)", () => {
  it("успешный разбан оживляет код, погашенный баном, и помечает audit-row codes_revived:true", async () => {
    const res = await call();
    const body = (await res.json()) as { ok: boolean; codes_revived: boolean };

    expect(res.status).toBe(200);
    expect(reviveBanDisabledCodesMock).toHaveBeenCalledWith("u1");
    expect(body).toMatchObject({ ok: true, codes_revived: true });
    expect(adminAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({ newValue: expect.objectContaining({ codes_revived: true }) }),
    );
  });

  it("сбой оживления кода НЕ откатывает уже закоммиченный разбан - ok:true, но codes_revived:false и громкий лог", async () => {
    reviveBanDisabledCodesMock.mockRejectedValue(new Error("connection refused"));
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await call();
    const body = (await res.json()) as { ok: boolean; codes_revived: boolean };

    expect(body).toMatchObject({ ok: true, codes_revived: false });
    expect(errSpy.mock.calls.some((c) => String(c[0]).includes("КРИТИЧНО"))).toBe(true);
    expect(adminAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({ newValue: expect.objectContaining({ codes_revived: false }) }),
    );

    errSpy.mockRestore();
  });

  it("юзер не blocked - 409 not_blocked, reviveBanDisabledCodes НЕ вызывается", async () => {
    userRow = { profile_completion: "completed", lifecycle_state: "active", pending_ban_prev_lifecycle: null };
    const res = await call();

    expect(res.status).toBe(409);
    expect(reviveBanDisabledCodesMock).not.toHaveBeenCalled();
    expect(adminAuditMock).not.toHaveBeenCalled();
  });

  it("tryTransition вернул конфликт - 409, reviveBanDisabledCodes НЕ вызывается", async () => {
    tryTransitionMock.mockResolvedValue({ ok: false, error: "conflict" });
    const res = await call();

    expect(res.status).toBe(409);
    expect(reviveBanDisabledCodesMock).not.toHaveBeenCalled();
  });
});
