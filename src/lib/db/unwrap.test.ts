import { describe, it, expect } from "vitest";
import { unwrapRows, unwrapCount, unwrapOne } from "./unwrap";

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

describe("unwrapCount", () => {
  it("returns the count on success", () => {
    expect(unwrapCount({ count: 7, error: null })).toBe(7);
  });

  it("returns 0 when count is null/undefined but no error (genuinely zero)", () => {
    expect(unwrapCount({ count: null, error: null })).toBe(0);
    expect(unwrapCount({ error: null })).toBe(0);
  });

  it("THROWS on a DB error instead of silently reporting 0 (hidden moderation backlog)", () => {
    expect(() => unwrapCount({ count: null, error: { message: "pool exhausted", code: "53300" } })).toThrow(
      /db count query failed: pool exhausted/,
    );
  });
});

describe("unwrapOne", () => {
  it("returns the row/object on success", () => {
    expect(unwrapOne({ data: { id: "x" }, error: null })).toEqual({ id: "x" });
  });

  it("returns null when data is null but no error (genuinely missing → notFound)", () => {
    expect(unwrapOne({ data: null, error: null })).toBeNull();
  });

  it("THROWS on a DB error instead of returning null (would be a false 404)", () => {
    expect(() => unwrapOne({ data: null, error: { message: "timeout", code: "57014" } })).toThrow(
      /db query failed: timeout/,
    );
  });
});
