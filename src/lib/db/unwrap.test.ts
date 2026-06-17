import { describe, it, expect } from "vitest";
import { unwrapRows } from "./unwrap";

describe("unwrapRows", () => {
  it("returns rows on success", () => {
    expect(unwrapRows({ data: [{ id: "a" }, { id: "b" }], error: null })).toEqual([
      { id: "a" },
      { id: "b" },
    ]);
  });

  it("returns [] when data is null but no error (genuinely empty)", () => {
    expect(unwrapRows({ data: null, error: null })).toEqual([]);
  });

  it("THROWS on a runtime DB error instead of returning silent-empty", () => {
    expect(() => unwrapRows({ data: null, error: { message: "connection lost", code: "57P01" } })).toThrow(
      /db query failed: connection lost/,
    );
  });
});
