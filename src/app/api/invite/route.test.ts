import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";
import type { DbUser } from "@/lib/auth/current-user";

// --- Task 8: GET /api/invite -----------------------------------------------
//
// Мокаем @/lib/auth/active-guard (гейт сессии/lifecycle - не предмет этого
// теста) и @/lib/invite/store целиком (уже покрыт своими тестами).
// GET() не принимает аргументов - реальный NextRequest здесь вообще не нужен.

const { loadActiveUserApiMock, ensureCodeForUserMock, countInvitedByMock } = vi.hoisted(() => ({
  loadActiveUserApiMock: vi.fn(),
  ensureCodeForUserMock: vi.fn(async () => "ABC123"),
  countInvitedByMock: vi.fn(async () => 0),
}));

vi.mock("@/lib/auth/active-guard", () => ({ loadActiveUserApi: loadActiveUserApiMock }));
vi.mock("@/lib/invite/store", () => ({
  ensureCodeForUser: ensureCodeForUserMock,
  countInvitedBy: countInvitedByMock,
}));

import { GET } from "./route";

function fakeUser(overrides: Partial<DbUser> = {}): DbUser {
  return {
    id: "u1",
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
    updated_at: "2026-08-11T00:00:00.000Z",
    ...overrides,
  };
}

beforeEach(() => {
  loadActiveUserApiMock.mockReset();
  ensureCodeForUserMock.mockReset();
  ensureCodeForUserMock.mockResolvedValue("ABC123");
  countInvitedByMock.mockReset();
  countInvitedByMock.mockResolvedValue(0);
});

describe("GET /api/invite (Task 8)", () => {
  it("нет активной сессии - пробрасывает готовый ответ гейта, код не выпускает", async () => {
    loadActiveUserApiMock.mockResolvedValue({
      res: NextResponse.json({ ok: false, error: "no_session" }, { status: 401 }),
    });
    const res = await GET();

    expect(res.status).toBe(401);
    expect(ensureCodeForUserMock).not.toHaveBeenCalled();
    expect(countInvitedByMock).not.toHaveBeenCalled();
  });

  it("верификация не approved - 403 not_verified, код НЕ выпускается", async () => {
    loadActiveUserApiMock.mockResolvedValue({ user: fakeUser({ verification_status: "pending_review" }) });
    const res = await GET();
    const body = (await res.json()) as { ok: boolean; error: string };

    expect(res.status).toBe(403);
    expect(body).toEqual({ ok: false, error: "not_verified" });
    expect(ensureCodeForUserMock).not.toHaveBeenCalled();
    expect(countInvitedByMock).not.toHaveBeenCalled();
  });

  it("approved - отдаёт код и ЧИСЛО приглашённых, без единого поля с именами", async () => {
    loadActiveUserApiMock.mockResolvedValue({ user: fakeUser({ id: "u42" }) });
    ensureCodeForUserMock.mockResolvedValue("ZX9K2M");
    countInvitedByMock.mockResolvedValue(7);

    const res = await GET();
    const body = (await res.json()) as Record<string, unknown>;

    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true, code: "ZX9K2M", invited: 7 });
    // Ключевая приватность-проверка: набор ключей ровно {ok, code, invited} -
    // если кто-то потом добавит "invited_users"/"referrals" со списком имён,
    // этот тест должен покраснеть, а не остаться зелёным на "invited === 7".
    expect(Object.keys(body).sort()).toEqual(["code", "invited", "ok"]);
    expect(ensureCodeForUserMock).toHaveBeenCalledWith("u42");
    expect(countInvitedByMock).toHaveBeenCalledWith("u42");
  });

  it("сбой БД при выпуске кода/счёта - структурированная ошибка {ok:false}, а не голый 500 без тела", async () => {
    loadActiveUserApiMock.mockResolvedValue({ user: fakeUser() });
    ensureCodeForUserMock.mockRejectedValue(new Error("connection refused"));
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await GET();
    const body = (await res.json()) as { ok: boolean; error: string };

    expect(res.status).toBe(500);
    expect(body.ok).toBe(false);
    expect(typeof body.error).toBe("string");
    expect(errSpy).toHaveBeenCalled();

    errSpy.mockRestore();
  });
});
