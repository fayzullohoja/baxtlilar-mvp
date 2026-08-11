import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

// Самоудаление аккаунта обязано уносить и скриншот отзыва.
//
// Список файлов берётся обходом папки человека в бакете, а не по ссылкам из
// базы: загрузка файла и запись отзыва идут в разные места и не в одной
// транзакции, поэтому файл, чья запись не создалась (суточный лимит, дедуп
// двойного тапа, обрыв запроса), в feedback.screenshot_path не попадает
// никогда. Список по базе оставил бы такой файл на диске навсегда, а на нём
// может быть чужая анкета.

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

/** Что и из какого бакета удалили. */
let removed: Array<[string, string[]]> = [];
/** Что лежит в папке человека в бакете отзывов - имена файлов, как отдаёт list(). */
let feedbackFiles: { name: string }[] = [];

function call() {
  const req = new Request("http://localhost/api/account", {
    method: "POST",
    body: JSON.stringify({ action: "delete" }),
  }) as unknown as NextRequest;
  return POST(req);
}

beforeEach(() => {
  removed = [];
  // Второй файл - осиротевший: записи с таким screenshot_path в базе нет.
  feedbackFiles = [{ name: "shot.png" }, { name: "orphan.png" }];
  loadActiveUserApiMock.mockReset();
  loadActiveUserApiMock.mockResolvedValue({
    user: { id: USER_ID, lifecycle_state: "active", phone_number: null },
  });
  clearSessionMock.mockClear();

  rpcMock.mockReset();
  rpcMock.mockResolvedValue({ data: null, error: null });

  fromMock.mockReset();
  fromMock.mockImplementation((table: string) => {
    if (table === "user_documents")
      return {
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { reject_category: null }, error: null }) }) }),
      };
    if (table === "profile_photos")
      return { select: () => ({ eq: async () => ({ data: [{ path: `${USER_ID}/photo.jpg` }], error: null }) }) };
    // Таблицы feedback тут быть не должно: пути скриншотов больше не берутся
    // из базы. Незнакомая таблица валит тест громко, а не молча.
    throw new Error(`неожиданная таблица в тесте: ${table}`);
  });

  storageFromMock.mockReset();
  storageFromMock.mockImplementation((bucket: string) => ({
    remove: async (paths: string[]) => {
      removed.push([bucket, paths]);
      return { error: null };
    },
    list: async () => ({
      data: bucket === BUCKET_FEEDBACK ? feedbackFiles : [],
      error: null,
    }),
  }));
});

describe("POST /api/account (delete) - чистка скриншотов отзывов", () => {
  it("сносит из бакета отзывов все файлы человека, включая те, на которые в базе нет ссылки", async () => {
    const res = await call();
    expect(res.status).toBe(200);

    const shots = removed.find(([bucket]) => bucket === BUCKET_FEEDBACK);
    expect(shots, "бакет скриншотов отзывов не чистится - файл переживёт удаление аккаунта").toBeTruthy();
    expect(shots?.[1]).toEqual([`${USER_ID}/shot.png`, `${USER_ID}/orphan.png`]);
  });

  it("пустая папка - в хранилище на удаление не ходим", async () => {
    feedbackFiles = [];
    await call();
    expect(removed.find(([bucket]) => bucket === BUCKET_FEEDBACK)).toBeUndefined();
  });

  it("сбой чистки скриншотов не роняет удаление - строки в базе уже обезличены", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    storageFromMock.mockImplementation((bucket: string) => ({
      remove: async () => ({ error: bucket === BUCKET_FEEDBACK ? { message: "disk full" } : null }),
      list: async () => ({ data: bucket === BUCKET_FEEDBACK ? feedbackFiles : [], error: null }),
    }));

    const res = await call();

    expect(res.status).toBe(200);
    errSpy.mockRestore();
  });
});
