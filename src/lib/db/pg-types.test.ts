import { describe, it, expect } from "vitest";
import { types } from "pg";
import { configurePgTypes } from "./pg-types";

// Регрессия: после миграции с PostgREST на node-pg дефолтные парсеры отдавали
// timestamptz/date как JS Date и bigint как строку → крах SSE-чата (cursor.replace),
// сломанный возраст, telegram_id-строка. Фиксируем паритет с PostgREST.
describe("pg type parsers (PostgREST parity)", () => {
  configurePgTypes();

  it("timestamptz (1184) → raw string, НЕ Date (чинит cursor.replace в SSE-чате)", () => {
    const v = types.getTypeParser(1184)("2026-06-16 13:57:32.205+00");
    expect(typeof v).toBe("string");
    expect(v).toBe("2026-06-16 13:57:32.205+00");
    expect(typeof (v as unknown as { replace?: unknown }).replace).toBe("function"); // .replace доступен
  });

  it("timestamp (1114) → string", () => {
    expect(types.getTypeParser(1114)("2026-06-16 13:57:32.205")).toBe("2026-06-16 13:57:32.205");
  });

  it("date (1082) → 'YYYY-MM-DD' string без сдвига TZ", () => {
    expect(types.getTypeParser(1082)("2026-01-01")).toBe("2026-01-01");
  });

  it("int8/bigint (20) → number (telegram_id)", () => {
    const v = types.getTypeParser(20)("8778476381");
    expect(typeof v).toBe("number");
    expect(v).toBe(8778476381);
  });
});
