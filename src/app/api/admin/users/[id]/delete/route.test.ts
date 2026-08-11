import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

// Полное удаление аккаунта обязано уносить и скриншот отзыва.
//
// Фото и документы чистятся по путям из RPC, а бакет отзывов - обходом папки
// человека. Разница не косметическая: путь скриншота попадает в базу не всегда
// (суточный лимит, дедуп двойного тапа, обрыв запроса кладут файл на диск без
// записи), поэтому список из RPC для него заведомо неполон, а на файле может
// быть чужая анкета. Здесь проверяем, что чистятся все три бакета и что
// неучтённый в базе файл тоже уходит.

const { requireAdminApiMock, rpcMock, removeMock, listMock, storageFromMock } = vi.hoisted(() => ({
  requireAdminApiMock: vi.fn(),
  rpcMock: vi.fn(),
  removeMock: vi.fn(),
  listMock: vi.fn(),
  storageFromMock: vi.fn(),
}));

vi.mock("@/lib/admin/guard", () => ({ requireAdminApi: requireAdminApiMock }));
vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({ rpc: rpcMock, storage: { from: storageFromMock } }),
}));

import { POST } from "./route";
import { BUCKET_DOCUMENTS, BUCKET_FEEDBACK, BUCKET_PHOTOS } from "@/lib/uploads/storage";

const PATHS = ["u1/photo.jpg", "u1/passport.jpg", "u1/feedback/shot.png"];
/** Что лежит в папке человека в бакете отзывов - имена файлов, как отдаёт list(). */
const SHOTS = [{ name: "1700000000000.png" }, { name: "1700000060000.png" }];

function call(id = "u1") {
  const req = new Request("http://localhost/api/admin/users/u1/delete", {
    method: "POST",
    body: JSON.stringify({ confirm: "DELETE", reason: "спам-аккаунт" }),
  }) as unknown as NextRequest;
  return POST(req, { params: Promise.resolve({ id }) });
}

beforeEach(() => {
  requireAdminApiMock.mockReset();
  requireAdminApiMock.mockResolvedValue({ session: { adminId: "admin-1", role: "superadmin" } });
  rpcMock.mockReset();
  rpcMock.mockResolvedValue({ data: { ok: true, storage_paths: PATHS }, error: null });
  removeMock.mockReset();
  removeMock.mockResolvedValue({ error: null });
  listMock.mockReset();
  listMock.mockResolvedValue({ data: SHOTS, error: null });
  storageFromMock.mockReset();
  storageFromMock.mockImplementation(() => ({ remove: removeMock, list: listMock }));
});

describe("POST /api/admin/users/[id]/delete - чистка файлов после hard-delete", () => {
  it("чистит все три приватных бакета, включая скриншоты отзывов", async () => {
    const res = await call();
    expect(res.status).toBe(200);

    const buckets = storageFromMock.mock.calls.map((c) => c[0] as string);
    expect(buckets).toContain(BUCKET_PHOTOS);
    expect(buckets).toContain(BUCKET_DOCUMENTS);
    // Без этого бакета скриншот с чужой анкетой остаётся на диске навсегда.
    expect(buckets).toContain(BUCKET_FEEDBACK);
    expect(removeMock).toHaveBeenCalledWith(PATHS);
  });

  it("сносит скриншоты обходом папки, а не по путям из RPC", async () => {
    // Файл, чья запись об отзыве не создалась, в storage_paths не попадёт -
    // и остался бы на диске навсегда, если чистить только по ним.
    await call();

    expect(listMock).toHaveBeenCalledWith("u1");
    expect(removeMock).toHaveBeenCalledWith(["u1/1700000000000.png", "u1/1700000060000.png"]);
  });

  it("сбой чистки одного бакета не роняет удаление - строки в базе уже нет", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    removeMock.mockRejectedValueOnce(new Error("bucket not found"));

    const res = await call();

    expect(res.status).toBe(200);
    // Три бакета по путям из RPC плюс отдельный обход папки отзывов.
    expect(storageFromMock.mock.calls.length).toBe(4);
    errSpy.mockRestore();
  });
});
