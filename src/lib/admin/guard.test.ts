import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Task 8: dispatchBanAction("confirm") должен гасить код приглашения ----
//
// Мокаем @/lib/supabase/admin на минимальный набор вызовов, которые реально
// делает dispatchBanAction на пути confirm:
//   1) sb.rpc("admin_ban_expire_sweep", ...)  - lazy-sweep ДО любого действия
//   2) sb.from("users").select(...).eq("id", userId).maybeSingle()
//   3) sb.rpc("admin_ban_confirm", ...)
//   4) sb.from("admin_audit_log").insert(...) - внутри adminAudit (НЕ мокаем
//      adminAudit целиком, чтобы реально проверить, что новое поле
//      codes_disabled долетает до audit-row)
//
// @/lib/invite/store мокаем полностью - store.ts уже покрыт своими тестами
// (store.test.ts), здесь важно только КТО и КОГДА вызывает disableCodesOfUser.
// @/lib/telegram/notify мокаем, чтобы не улетать в реальный fetch.
//
// vi.hoisted() обязателен для моков, которые ссылаются на переменную НАПРЯМУЮ
// (не через обёртку-геттер вида "() => realCall(...)"): vi.mock() хоистится
// над обычными const/let, и без vi.hoisted() чтение переменной внутри фабрики
// попадёт в её же TDZ ("Cannot access ... before initialization").

const { rpcMock, fromMock, notifyUserMock, disableCodesOfUserMock } = vi.hoisted(() => ({
  rpcMock: vi.fn(),
  fromMock: vi.fn(),
  notifyUserMock: vi.fn(async () => true),
  disableCodesOfUserMock: vi.fn(async () => {}),
}));

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({ rpc: rpcMock, from: fromMock }),
}));
vi.mock("@/lib/telegram/notify", () => ({ notifyUser: notifyUserMock }));
vi.mock("@/lib/invite/store", () => ({ disableCodesOfUser: disableCodesOfUserMock }));

import { dispatchBanAction } from "./guard";
import type { AdminSession } from "./session";

type UsersRow = {
  id: string;
  telegram_id: number | null;
  updated_at: string;
  lifecycle_state: string;
  quiz_completion?: string;
  profile_completion?: string;
  pending_ban_at?: string | null;
  pending_ban_by_admin_id?: string | null;
  pending_ban_reason?: string | null;
};

let userRow: UsersRow | null = null;
let banConfirmResult: Record<string, unknown> = {
  ok: true,
  final_reason: "test",
  proposer_admin_id: "a0",
  proposer_reason: "test",
};
const auditInserts: Array<Record<string, unknown>> = [];

rpcMock.mockImplementation(async (name: string) => {
  if (name === "admin_ban_expire_sweep") return { data: [], error: null };
  if (name === "admin_ban_confirm") return { data: banConfirmResult, error: null };
  throw new Error(`неожиданный rpc в тесте: ${name}`);
});

fromMock.mockImplementation((table: string) => {
  if (table === "users") {
    return {
      select: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve({ data: userRow, error: null }),
        }),
      }),
    };
  }
  if (table === "admin_audit_log") {
    return {
      insert: (row: Record<string, unknown>) => {
        auditInserts.push(row);
        return Promise.resolve({ error: null });
      },
    };
  }
  throw new Error(`неожиданная таблица в тесте: ${table}`);
});

const session: AdminSession = { adminId: "admin-1", role: "superadmin" };
const req = new Request("http://localhost/api/admin/users/u1/ban") as unknown as Parameters<
  typeof dispatchBanAction
>[4];

beforeEach(() => {
  userRow = {
    id: "u1",
    telegram_id: null, // без push-уведомления - тест не завязан на notifyUser
    updated_at: "2026-08-11T00:00:00.000Z",
    lifecycle_state: "pending_ban",
    profile_completion: "completed",
  };
  banConfirmResult = { ok: true, final_reason: "test", proposer_admin_id: "a0", proposer_reason: "test" };
  auditInserts.length = 0;
  rpcMock.mockClear();
  fromMock.mockClear();
  notifyUserMock.mockClear();
  disableCodesOfUserMock.mockReset();
  disableCodesOfUserMock.mockResolvedValue(undefined);
});

describe("dispatchBanAction(confirm) - гашение кода приглашения (Task 8)", () => {
  it("успешный confirm гасит код с причиной 'ban' и помечает audit-row codes_disabled:true", async () => {
    const res = await dispatchBanAction(session, "u1", "confirm", {}, req);
    const body = (await res.json()) as { ok: boolean; status: string; codes_disabled: boolean };

    expect(disableCodesOfUserMock).toHaveBeenCalledWith("u1", "ban");
    expect(body).toMatchObject({ ok: true, status: "blocked", codes_disabled: true });

    const auditRow = auditInserts.find((r) => r.action === "ban_confirmed");
    expect(auditRow).toBeDefined();
    expect((auditRow!.new_value as Record<string, unknown>).codes_disabled).toBe(true);
  });

  it("сбой гашения кода НЕ откатывает уже закоммиченный бан - ответ ok:true, но с codes_disabled:false и громким логом", async () => {
    disableCodesOfUserMock.mockRejectedValue(new Error("connection refused"));
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await dispatchBanAction(session, "u1", "confirm", {}, req);
    const body = (await res.json()) as { ok: boolean; status: string; codes_disabled: boolean };

    // Бан ВЫПОЛНЕН (RPC уже закоммитил blocked) - роут не лжёт об этом 500-кой.
    expect(body).toMatchObject({ ok: true, status: "blocked", codes_disabled: false });
    // Но провал громко залогирован...
    expect(errSpy).toHaveBeenCalled();
    expect(errSpy.mock.calls.some((c) => String(c[0]).includes("КРИТИЧНО"))).toBe(true);
    // ...и зафиксирован в audit-row, а не потерян.
    const auditRow = auditInserts.find((r) => r.action === "ban_confirmed");
    expect((auditRow!.new_value as Record<string, unknown>).codes_disabled).toBe(false);

    errSpy.mockRestore();
  });

  it("RPC вернул not_eligible (r.ok=false) - disableCodesOfUser НЕ вызывается вообще", async () => {
    banConfirmResult = { ok: false, error: "not_eligible", state: "active" };
    const res = await dispatchBanAction(session, "u1", "confirm", {}, req);

    expect(res.status).toBe(409);
    expect(disableCodesOfUserMock).not.toHaveBeenCalled();
    expect(auditInserts).toHaveLength(0);
  });
});
