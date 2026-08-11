import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

// Полное удаление аккаунта обязано уносить и скриншот отзыва.
//
// RPC отдаёт пути файлов ДО удаления строк - после каскада указателя на файл в
// базе уже нет, и осиротевший скриншот не найти ничем: сборщика лишних файлов в
// проекте нет, housekeeping-крон в бакеты не заглядывает. Роут знал только про
// фото и документы, поэтому файл с чужой анкетой переживал «необратимое»
// удаление. Здесь проверяем, что чистятся все три бакета.

const { requireAdminApiMock, rpcMock, removeMock, storageFromMock } = vi.hoisted(() => ({
  requireAdminApiMock: vi.fn(),
  rpcMock: vi.fn(),
  removeMock: vi.fn(),
  storageFromMock: vi.fn(),
}));

vi.mock("@/lib/admin/guard", () => ({ requireAdminApi: requireAdminApiMock }));
vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({ rpc: rpcMock, storage: { from: storageFromMock } }),
}));

import { POST } from "./route";
import { BUCKET_DOCUMENTS, BUCKET_FEEDBACK, BUCKET_PHOTOS } from "@/lib/uploads/storage";

const PATHS = ["u1/photo.jpg", "u1/passport.jpg", "u1/feedback/shot.png"];

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
  storageFromMock.mockReset();
  storageFromMock.mockImplementation(() => ({ remove: removeMock }));
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

  it("сбой чистки одного бакета не роняет удаление - строки в базе уже нет", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    removeMock.mockRejectedValueOnce(new Error("bucket not found"));

    const res = await call();

    expect(res.status).toBe(200);
    expect(storageFromMock.mock.calls.length).toBe(3);
    errSpy.mockRestore();
  });
});
