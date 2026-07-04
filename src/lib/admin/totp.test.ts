import { describe, it, expect } from "vitest";
import {
  base32Encode,
  base32Decode,
  totpFromBytes,
  verifyTotp,
  generateTotpSecret,
} from "./totp";

// SEC-2 — TOTP (RFC 6238) hand-roll на node:crypto. Проверяем официальными
// тест-векторами RFC 6238 (Appendix B, SHA-1, seed = ASCII "12345678901234567890").

const SEED = Buffer.from("12345678901234567890", "ascii");

describe("totpFromBytes — RFC 6238 test vectors (8 digits, SHA-1, step 30)", () => {
  const vectors: [number, string][] = [
    [59, "94287082"],
    [1111111109, "07081804"],
    [1111111111, "14050471"],
    [1234567890, "89005924"],
    [2000000000, "69279037"],
    [20000000000, "65353130"],
  ];
  for (const [time, expected] of vectors) {
    it(`T=${time} → ${expected}`, () => {
      expect(totpFromBytes(SEED, time, 30, 8)).toBe(expected);
    });
  }

  it("6-значный код = последние 6 цифр 8-значного", () => {
    expect(totpFromBytes(SEED, 59, 30, 6)).toBe("287082");
  });
});

describe("base32 (RFC 4648)", () => {
  it("round-trip произвольных байтов", () => {
    const buf = Buffer.from([0xde, 0xad, 0xbe, 0xef, 0x00, 0x11, 0x22]);
    expect(base32Decode(base32Encode(buf))).toEqual(buf);
  });

  it("кодирует без паддинга и в верхнем регистре A-Z2-7", () => {
    const enc = base32Encode(Buffer.from("hello", "ascii"));
    expect(enc).toMatch(/^[A-Z2-7]+$/);
    expect(base32Decode(enc).toString("ascii")).toBe("hello");
  });

  it("decode терпит пробелы и нижний регистр (ввод пользователя)", () => {
    const enc = base32Encode(Buffer.from("world", "ascii"));
    const messy = enc.toLowerCase().replace(/(.{2})/g, "$1 ");
    expect(base32Decode(messy).toString("ascii")).toBe("world");
  });
});

describe("verifyTotp", () => {
  const secret = base32Encode(SEED);

  it("принимает код текущего окна", () => {
    // T=59 → окно 1 (59/30=1). Код 287082 действителен внутри окна.
    expect(verifyTotp(secret, "287082", 59, 1)).toBe(true);
  });

  it("принимает соседнее окно (±1, дрейф часов)", () => {
    // код окна T=59 должен пройти при проверке на T=59+30 (следующее окно) с window=1
    expect(verifyTotp(secret, "287082", 59 + 30, 1)).toBe(true);
  });

  it("отвергает код вне окна (±1)", () => {
    expect(verifyTotp(secret, "287082", 59 + 120, 1)).toBe(false);
  });

  it("отвергает мусор и неверную длину", () => {
    expect(verifyTotp(secret, "000000", 59, 1)).toBe(false);
    expect(verifyTotp(secret, "12345", 59, 1)).toBe(false);
    expect(verifyTotp(secret, "abcdef", 59, 1)).toBe(false);
  });
});

describe("generateTotpSecret", () => {
  it("возвращает base32-строку, декодируемую в >=20 байт", () => {
    const s = generateTotpSecret();
    expect(s).toMatch(/^[A-Z2-7]+$/);
    expect(base32Decode(s).length).toBeGreaterThanOrEqual(20);
  });
});
