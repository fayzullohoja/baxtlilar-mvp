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

import { createStorage, verifyStorageSig, stableExp } from "./fs-store";

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

describe("fs-store: exp округляется до сетки (иначе кеш браузера не работает)", () => {
  const TTL = 3600;
  const STEP = 900; // max(60, ttl/4)

  it("внутри окна ссылка на один файл не меняется", async () => {
    const s = createStorage().from("profile-photos");
    // Три момента в пределах одного окна — URL обязан совпасть побайтово,
    // иначе браузер считает это разными картинками и качает их заново.
    const base = 1_800_000_000_000;
    const a = stableExp(TTL, base);
    const b = stableExp(TTL, base + 60_000);
    const c = stableExp(TTL, base + (STEP - 1) * 1000);
    expect(a).toBe(b);
    expect(b).toBe(c);

    const u1 = await s.createSignedUrl("u1/photo_0_123.jpg", TTL);
    const u2 = await s.createSignedUrl("u1/photo_0_123.jpg", TTL);
    expect(u1.data?.signedUrl).toBe(u2.data?.signedUrl);
  });

  it("в следующем окне ссылка обновляется", () => {
    const base = 1_800_000_000_000;
    expect(stableExp(TTL, base + STEP * 1000)).toBeGreaterThan(stableExp(TTL, base));
  });

  it("запас жизни ссылки не меньше ttl минус шаг — не протухнет под руками", () => {
    for (let i = 0; i < 500; i++) {
      const nowMs = 1_800_000_000_000 + i * 7_000;
      const remaining = stableExp(TTL, nowMs) - Math.floor(nowMs / 1000);
      expect(remaining).toBeGreaterThanOrEqual(TTL - STEP);
      expect(remaining).toBeLessThanOrEqual(TTL);
    }
  });

  it("запас в три четверти срока держится на ЛЮБОМ ttl, а не только на удачном", () => {
    // Ловушка, из-за которой был пол в 60 секунд: при step >= ttl множитель
    // схлопывается в единицу, и на хвосте окна ссылка выдаётся с остатком в
    // одну секунду. В боевом коде сейчас 300, 600 и 3600, но проверяем и
    // короткие - чтобы новый вызов с маленьким ttl не завёл плавающие 403.
    for (const ttl of [10, 60, 120, 300, 600, 3600]) {
      let worst = Infinity;
      for (let i = 0; i < 400; i++) {
        const nowMs = 1_800_000_000_000 + i * 1000;
        worst = Math.min(worst, stableExp(ttl, nowMs) - Math.floor(nowMs / 1000));
      }
      expect(worst).toBeGreaterThanOrEqual(Math.floor(ttl * 0.7));
      expect(worst).toBeLessThanOrEqual(ttl);
    }
  });

  it("короткий ttl документов остаётся коротким", () => {
    // Паспорт/селфи перезаписываются по тому же пути, поэтому срок жизни
    // ссылки обязан остаться коротким - иначе модератор увидит старый документ.
    const remaining = stableExp(300, 1_800_000_000_000) - 1_800_000_000;
    expect(remaining).toBeGreaterThan(0);
    expect(remaining).toBeLessThanOrEqual(300);
  });

  it("округлённый exp по-прежнему проходит проверку подписи", async () => {
    const s = createStorage().from("profile-photos");
    const { data } = await s.createSignedUrl("u2/photo_1_456.jpg", TTL);
    const u = new URL(data!.signedUrl, "http://x");
    const exp = Number(u.searchParams.get("exp"));
    const sig = u.searchParams.get("sig") ?? "";
    expect(verifyStorageSig("profile-photos", "u2/photo_1_456.jpg", exp, sig)).toBe(true);
    // подпись привязана к exp: соседнее значение не принимается
    expect(verifyStorageSig("profile-photos", "u2/photo_1_456.jpg", exp + 1, sig)).toBe(false);
  });
});
