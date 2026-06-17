import { describe, it, expect } from "vitest";
import { assertSmsConfig } from "./env";

describe("assertSmsConfig (предохранитель запуска)", () => {
  it("бросает при SMS_STRICT + mock (фиктивная верификация)", () => {
    expect(() => assertSmsConfig({ SMS_PROVIDER: "mock", SMS_STRICT: true })).toThrow(/mock/i);
  });

  it("пропускает mock без строгого режима (текущий пре-лонч прод)", () => {
    expect(() => assertSmsConfig({ SMS_PROVIDER: "mock", SMS_STRICT: false })).not.toThrow();
  });

  it("пропускает реальный провайдер в строгом режиме", () => {
    expect(() => assertSmsConfig({ SMS_PROVIDER: "eskiz", SMS_STRICT: true })).not.toThrow();
    expect(() => assertSmsConfig({ SMS_PROVIDER: "playmobile", SMS_STRICT: true })).not.toThrow();
  });
});
