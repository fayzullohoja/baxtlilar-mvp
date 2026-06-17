import { describe, it, expect } from "vitest";
import { safeEqual } from "./safe-equal";

describe("safeEqual", () => {
  it("returns true for identical strings", () => {
    expect(safeEqual("abc123", "abc123")).toBe(true);
    expect(safeEqual("", "")).toBe(true);
  });

  it("returns false for same-length but different content", () => {
    expect(safeEqual("abc123", "abc124")).toBe(false);
    expect(safeEqual("aaaa", "bbbb")).toBe(false);
  });

  it("returns false for different lengths (no throw)", () => {
    expect(safeEqual("abc", "abcd")).toBe(false);
    expect(safeEqual("abcd", "abc")).toBe(false);
    expect(safeEqual("", "x")).toBe(false);
  });

  it("matches realistic base64url HMAC signatures", () => {
    const sig = "Zm9vYmFyYmF6cXV4MTIzNDU2Nzg5MA";
    expect(safeEqual(sig, sig)).toBe(true);
    expect(safeEqual(sig, sig.slice(0, -1) + "X")).toBe(false);
  });
});
