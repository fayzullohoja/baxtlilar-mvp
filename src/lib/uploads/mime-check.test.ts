import { describe, it, expect } from "vitest";
import { detectImageType, extForType } from "./mime-check";

const pad = (head: number[]) => {
  const a = new Uint8Array(16);
  head.forEach((b, i) => (a[i] = b));
  return a;
};
const ascii = (s: string) => s.split("").map((c) => c.charCodeAt(0));

describe("detectImageType", () => {
  it("JPEG", () => {
    expect(detectImageType(pad([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
  });
  it("PNG", () => {
    expect(detectImageType(pad([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe("image/png");
  });
  it("WebP", () => {
    const a = new Uint8Array(16);
    ascii("RIFF").forEach((b, i) => (a[i] = b));
    ascii("WEBP").forEach((b, i) => (a[8 + i] = b));
    expect(detectImageType(a)).toBe("image/webp");
  });
  it("HEIC", () => {
    const a = new Uint8Array(16);
    ascii("ftyp").forEach((b, i) => (a[4 + i] = b));
    ascii("heic").forEach((b, i) => (a[8 + i] = b));
    expect(detectImageType(a)).toBe("image/heic");
  });
  it("не-изображение (PDF) → null", () => {
    expect(detectImageType(pad(ascii("%PDF-1.7")))).toBeNull();
  });
  it("слишком короткий → null", () => {
    expect(detectImageType(new Uint8Array([0xff, 0xd8]))).toBeNull();
  });
  it("extForType", () => {
    expect(extForType("image/jpeg")).toBe("jpg");
  });
});
