import { describe, it, expect } from "vitest";
import { normalizeUzPhone, formatUzPhone, PhoneError } from "./phone";

describe("normalizeUzPhone", () => {
  it("9-значный национальный", () => {
    expect(normalizeUzPhone("901234567")).toBe("+998901234567");
  });
  it("с кодом 998", () => {
    expect(normalizeUzPhone("998901234567")).toBe("+998901234567");
  });
  it("полный +998 с пробелами/дефисами", () => {
    expect(normalizeUzPhone("+998 90 123-45-67")).toBe("+998901234567");
  });
  it("в скобках", () => {
    expect(normalizeUzPhone("(998) 90 1234567")).toBe("+998901234567");
  });
  it("пустой → ошибка", () => {
    expect(() => normalizeUzPhone("")).toThrow(PhoneError);
  });
  it("слишком короткий → ошибка", () => {
    expect(() => normalizeUzPhone("12345")).toThrow(PhoneError);
  });
  it("чужой код (российский 11 цифр) → ошибка", () => {
    expect(() => normalizeUzPhone("79161234567")).toThrow(PhoneError);
  });
});

describe("formatUzPhone", () => {
  it("красивая маска", () => {
    expect(formatUzPhone("+998901234567")).toBe("+998 90 123 45 67");
  });
});
