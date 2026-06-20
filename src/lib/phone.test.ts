import { describe, it, expect } from "vitest";
import {
  normalizeUzPhone,
  normalizeInternationalPhone,
  isUzMobile,
  formatUzPhone,
  PhoneError,
} from "./phone";

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

describe("normalizeInternationalPhone", () => {
  it("UZ +998 12 цифр", () => {
    expect(normalizeInternationalPhone("+998901234567")).toBe("+998901234567");
  });
  it("US +1 11 цифр", () => {
    expect(normalizeInternationalPhone("+15551234567")).toBe("+15551234567");
  });
  it("RU +7 11 цифр", () => {
    expect(normalizeInternationalPhone("+79161234567")).toBe("+79161234567");
  });
  it("TR +90 12 цифр", () => {
    expect(normalizeInternationalPhone("+905321234567")).toBe("+905321234567");
  });
  it("AE +971 12 цифр", () => {
    expect(normalizeInternationalPhone("+971501234567")).toBe("+971501234567");
  });
  it("UK +44 12 цифр", () => {
    expect(normalizeInternationalPhone("+442012345678")).toBe("+442012345678");
  });
  it("CN +86 13 цифр", () => {
    expect(normalizeInternationalPhone("+8613812345678")).toBe("+8613812345678");
  });
  it("без '+' (TG иногда так шлёт)", () => {
    expect(normalizeInternationalPhone("15551234567")).toBe("+15551234567");
  });
  it("с пробелами, скобками, дефисами", () => {
    expect(normalizeInternationalPhone("+1 (555) 123-4567")).toBe("+15551234567");
  });
  it("пустой → ошибка", () => {
    expect(() => normalizeInternationalPhone("")).toThrow(PhoneError);
  });
  it("слишком короткий (<8) → ошибка", () => {
    expect(() => normalizeInternationalPhone("1234567")).toThrow(PhoneError);
  });
  it("слишком длинный (>15) → ошибка", () => {
    expect(() => normalizeInternationalPhone("1234567890123456")).toThrow(PhoneError);
  });
  it("мусор без цифр → ошибка", () => {
    expect(() => normalizeInternationalPhone("abc-def")).toThrow(PhoneError);
  });
});

describe("isUzMobile", () => {
  it("УЗ → true", () => {
    expect(isUzMobile("+998901234567")).toBe(true);
  });
  it("не-УЗ → false", () => {
    expect(isUzMobile("+15551234567")).toBe(false);
    expect(isUzMobile("+79161234567")).toBe(false);
    expect(isUzMobile("+998")).toBe(false);
  });
});

describe("formatUzPhone", () => {
  it("красивая маска", () => {
    expect(formatUzPhone("+998901234567")).toBe("+998 90 123 45 67");
  });
  it("не-УЗ номер возвращается as-is", () => {
    expect(formatUzPhone("+15551234567")).toBe("+15551234567");
  });
});
