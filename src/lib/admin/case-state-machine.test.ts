import { describe, it, expect } from "vitest";
import { canTransition, terminalStates } from "./case-state-machine";

describe("canTransition", () => {
  it("allows new → assigned (claim)", () => {
    expect(canTransition("new", "assigned")).toBe(true);
  });
  it("allows assigned → in_review", () => {
    expect(canTransition("assigned", "in_review")).toBe(true);
  });
  it("allows assigned → data_entry (skip in_review for simple flow)", () => {
    expect(canTransition("assigned", "data_entry")).toBe(true);
  });
  it("allows in_review → data_entry", () => {
    expect(canTransition("in_review", "data_entry")).toBe(true);
  });
  it("allows data_entry → ready_to_decide", () => {
    expect(canTransition("data_entry", "ready_to_decide")).toBe(true);
  });
  it("allows ready_to_decide → closed", () => {
    expect(canTransition("ready_to_decide", "closed")).toBe(true);
  });
  it("allows direct close from data_entry (approve happy path)", () => {
    expect(canTransition("data_entry", "closed")).toBe(true);
  });
  it("allows assigned → new (unclaim)", () => {
    expect(canTransition("assigned", "new")).toBe(true);
  });
  it("forbids closed → anything", () => {
    expect(canTransition("closed", "new")).toBe(false);
    expect(canTransition("closed", "data_entry")).toBe(false);
    expect(canTransition("closed", "assigned")).toBe(false);
  });
  it("forbids new → data_entry (must claim first)", () => {
    expect(canTransition("new", "data_entry")).toBe(false);
  });
  it("forbids new → ready_to_decide", () => {
    expect(canTransition("new", "ready_to_decide")).toBe(false);
  });
});

describe("terminalStates", () => {
  it("includes closed", () => {
    expect(terminalStates.has("closed")).toBe(true);
  });
  it("excludes ready_to_decide", () => {
    expect(terminalStates.has("ready_to_decide")).toBe(false);
  });
  it("excludes data_entry", () => {
    expect(terminalStates.has("data_entry")).toBe(false);
  });
});
