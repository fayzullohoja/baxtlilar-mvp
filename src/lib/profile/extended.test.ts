import { describe, it, expect } from "vitest";
import { stampExtended } from "./extended";
import { EXTENDED_SCHEMA_VERSION } from "./schemas";

describe("stampExtended — версия схемы в extended._meta", () => {
  it("проставляет текущую EXTENDED_SCHEMA_VERSION", () => {
    const out = stampExtended({ family: { views: ["a"] } });
    expect((out._meta as { schema_version: number }).schema_version).toBe(EXTENDED_SCHEMA_VERSION);
  });

  it("сохраняет остальные секции", () => {
    const out = stampExtended({ family: { decision_model: "joint" }, self: { x: 1 } });
    expect(out.family).toEqual({ decision_model: "joint" });
    expect(out.self).toEqual({ x: 1 });
  });

  it("сохраняет прежние поля _meta (напр. completed_at)", () => {
    const out = stampExtended({ _meta: { completed_at: "2026-07-01T00:00:00Z" } });
    expect(out._meta).toEqual({
      completed_at: "2026-07-01T00:00:00Z",
      schema_version: EXTENDED_SCHEMA_VERSION,
    });
  });

  it("не мутирует вход", () => {
    const input = { family: { views: ["a"] } };
    const out = stampExtended(input);
    expect(out).not.toBe(input);
    expect(input).toEqual({ family: { views: ["a"] } }); // _meta не добавился во вход
  });
});
