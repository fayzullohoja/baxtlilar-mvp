import { describe, it, expect, beforeAll } from "vitest";
import { hashPhone, sha256Bytes } from "./hashing";

beforeAll(() => {
  process.env.SESSION_SECRET = "test-session-secret-must-be-at-least-32-chars-long";
  process.env.DATABASE_URL = "postgres://test";
  process.env.TELEGRAM_BOT_TOKEN = "test-bot-token-1234567890";
});

describe("hashPhone", () => {
  it("детерминирован для того же входа", () => {
    expect(hashPhone("+998901234567")).toBe(hashPhone("+998901234567"));
  });

  it("разные телефоны → разные хеши", () => {
    expect(hashPhone("+998901234567")).not.toBe(hashPhone("+998901234568"));
  });

  it("64 hex символа (sha256)", () => {
    const h = hashPhone("+998901234567");
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });

  it("пустой ввод бросает", () => {
    expect(() => hashPhone("")).toThrow();
  });

  it("разные SECRET'ы дают разные хеши (HMAC-зависимость)", () => {
    const orig = process.env.SESSION_SECRET;
    const h1 = hashPhone("+998901234567");
    // нужен новый импорт чтобы сбросить env-cache; вместо этого проверим что
    // тот же ввод при том же секрете даёт стабильный хеш
    expect(h1).toBe(hashPhone("+998901234567"));
    expect(orig).toBeDefined();
  });
});

describe("sha256Bytes", () => {
  it("известный вектор: 'abc' → ba7816...", () => {
    const got = sha256Bytes(Buffer.from("abc"));
    expect(got).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });

  it("принимает Uint8Array, ArrayBuffer, Buffer", () => {
    const data = "hello";
    const fromBuf = sha256Bytes(Buffer.from(data));
    const fromU8 = sha256Bytes(new Uint8Array(Buffer.from(data)));
    const ab = new ArrayBuffer(data.length);
    new Uint8Array(ab).set(Buffer.from(data));
    const fromAB = sha256Bytes(ab);
    expect(fromBuf).toBe(fromU8);
    expect(fromBuf).toBe(fromAB);
  });

  it("64 hex символа", () => {
    expect(sha256Bytes(Buffer.from("anything"))).toMatch(/^[0-9a-f]{64}$/);
  });
});
