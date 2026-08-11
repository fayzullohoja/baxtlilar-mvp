import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

// Самоудаление аккаунта обязано уносить и скриншот отзыва.
//
// erase_user строку users не удаляет, а обезличивает, поэтому on delete cascade
// у feedback.user_id не срабатывает никогда: строку отзыва глушит сам erase_user,
// а файл на диске остаётся - его надо снести из бакета руками. Пути обязаны
// собираться ДО RPC: после него screenshot_path уже null и файл не найти.

const { loadActiveUserApiMock, clearSessionMock, fromMock, rpcMock, storageFromMock } = vi.hoisted(
  () => ({
    loadActiveUserApiMock: vi.fn(),
    clearSessionMock: vi.fn(async () => {}),
    fromMock: vi.fn(),
    rpcMock: vi.fn(),
    storageFromMock: vi.fn(),
  }),
);

vi.mock("@/lib/auth/active-guard", () => ({ loadActiveUserApi: loadActiveUserApiMock }));
vi.mock("@/lib/auth/session", () => ({ clearSession: clearSessionMock }));
vi.mock("@/lib/state-machine/transitions", () => ({ tryTransition: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({ from: fromMock, rpc: rpcMock, storage: { from: storageFromMock } }),
}));

import { POST } from "./route";
import { BUCKET_FEEDBACK } from "@/lib/uploads/storage";

const USER_ID = "11111111-1111-1111-1111-111111111111";

/** Порядок обращений к базе - нужен, чтобы поймать сбор путей ПОСЛЕ erase_user. */
let order: string[] = [];
/** Что и из какого бакета удалили. */
let removed: Array<[string, string[]]> = [];

function call() {
  const req = new Request("http://localhost/api/account", {
    method: "POST",
    body: JSON.stringify({ action: "delete" }),
  }) as unknown as NextRequest;
  return POST(req);
}

beforeEach(() => {
  order = [];
  removed = [];
  loadActiveUserApiMock.mockReset();
  loadActiveUserApiMock.mockResolvedValue({
    user: { id: USER_ID, lifecycle_state: "active", phone_number: null },
  });
  clearSessionMock.mockClear();

  rpcMock.mockReset();
  rpcMock.mockImplementation(async (name: string) => {
    order.push(`rpc:${name}`);
    return { data: null, error: null };
  });

  fromMock.mockReset();
  fromMock.mockImplementation((table: string) => {
    order.push(`from:${table}`);
    if (table === "user_documents")
      return {
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { reject_category: null }, error: null }) }) }),
      };
    if (table === "profile_photos")
      return { select: () => ({ eq: async () => ({ data: [{ path: `${USER_ID}/photo.jpg` }], error: null }) }) };
    if (table === "feedback")
      return {
        select: () => ({
          eq: async () => ({
            // вторая строка - отзыв без скриншота: в список на удаление попасть не должна
            data: [{ screenshot_path: `${USER_ID}/shot.png` }, { screenshot_path: null }],
            error: null,
          }),
        }),
      };
    throw new Error(`неожиданная таблица в тесте: ${table}`);
  });

  storageFromMock.mockReset();
  storageFromMock.mockImplementation((bucket: string) => ({
    remove: async (paths: string[]) => {
      removed.push([bucket, paths]);
      return { error: null };
    },
    list: async () => ({ data: [] }),
  }));
});

describe("POST /api/account (delete) - чистка скриншотов отзывов", () => {
  it("сносит файл скриншота из бакета отзывов и не тащит туда null-пути", async () => {
    const res = await call();
    expect(res.status).toBe(200);

    const shots = removed.find(([bucket]) => bucket === BUCKET_FEEDBACK);
    expect(shots, "бакет скриншотов отзывов не чистится - файл переживёт удаление аккаунта").toBeTruthy();
    expect(shots?.[1]).toEqual([`${USER_ID}/shot.png`]);
  });

  it("собирает пути ДО erase_user - после него screenshot_path уже обнулён", async () => {
    await call();
    expect(order.indexOf("from:feedback")).toBeGreaterThanOrEqual(0);
    expect(order.indexOf("from:feedback")).toBeLessThan(order.indexOf("rpc:erase_user"));
  });
});
