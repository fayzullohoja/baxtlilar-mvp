import { describe, it, expect, beforeAll, afterAll } from "vitest";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";

// env() читается лениво — выставляем до первого вызова
const TEST_DIR = path.join(os.tmpdir(), "bx-fsstore-test");
process.env.SESSION_SECRET = "test-secret-test-secret-test-secret-123";
process.env.DATABASE_URL = "postgres://localhost/none";
process.env.TELEGRAM_BOT_TOKEN = "telegram-bot-token-xxxxxxxx";
process.env.STORAGE_DIR = TEST_DIR;

import { createStorage, verifyStorageSig } from "./fs-store";

function parseSigned(url: string) {
  const u = new URL(url, "http://x");
  return { exp: Number(u.searchParams.get("exp")), sig: u.searchParams.get("sig") ?? "" };
}

beforeAll(async () => {
  await fs.mkdir(TEST_DIR, { recursive: true });
});
afterAll(async () => {
  await fs.rm(TEST_DIR, { recursive: true, force: true });
});

describe("fs-store: signing", () => {
  it("createSignedUrl → verifiable, tamper + expiry rejected", async () => {
    const s = createStorage().from("profile-photos");
    const { data } = await s.createSignedUrl("u1/photo_0.jpg", 60);
    expect(data?.signedUrl).toMatch(/^\/api\/storage\/o\/profile-photos\/u1\/photo_0\.jpg\?exp=\d+&sig=/);

    const { exp, sig } = parseSigned(data!.signedUrl);
    expect(verifyStorageSig("profile-photos", "u1/photo_0.jpg", exp, sig)).toBe(true);

    // подделанная подпись
    expect(verifyStorageSig("profile-photos", "u1/photo_0.jpg", exp, sig + "x")).toBe(false);
    // другой путь под той же подписью
    expect(verifyStorageSig("profile-photos", "u1/other.jpg", exp, sig)).toBe(false);
    // истёкший срок
    expect(verifyStorageSig("profile-photos", "u1/photo_0.jpg", 1, sig)).toBe(false);
  });
});

describe("fs-store: filesystem roundtrip", () => {
  it("upload → list → remove", async () => {
    const s = createStorage().from("user-documents");
    const up = await s.upload("user42/passport.jpg", new Uint8Array([1, 2, 3]), {
      contentType: "image/jpeg",
      upsert: true,
    });
    expect(up.error).toBeNull();
    expect(up.data?.path).toBe("user42/passport.jpg");

    const ls = await s.list("user42");
    expect(ls.data?.map((f) => f.name)).toContain("passport.jpg");

    const rm = await s.remove(["user42/passport.jpg"]);
    expect(rm.error).toBeNull();
    const ls2 = await s.list("user42");
    expect(ls2.data?.map((f) => f.name)).not.toContain("passport.jpg");
  });

  it("blocks path traversal", async () => {
    const s = createStorage().from("user-documents");
    const up = await s.upload("../../etc/evil", new Uint8Array([1]), { upsert: true });
    expect(up.error).not.toBeNull();
  });
});
