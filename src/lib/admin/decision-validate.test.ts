import { describe, it, expect } from "vitest";
import { validateDecisionBody } from "./decision-validate";

describe("validateDecisionBody — матрица action × reject_category", () => {
  // -------- approve --------
  it("approve без category → ok", () => {
    const r = validateDecisionBody({ action: "approve" });
    expect(r).toEqual({ ok: true, action: "approve", rejectCategory: null });
  });
  it("approve + category → category_not_allowed", () => {
    const r = validateDecisionBody({ action: "approve", reject_category: "technical" });
    expect(r).toEqual({ ok: false, error: "category_not_allowed" });
  });

  // -------- reject --------
  it("reject без category → category_required", () => {
    const r = validateDecisionBody({ action: "reject", reason: "плохое фото" });
    expect(r).toEqual({ ok: false, error: "category_required" });
  });
  it("reject + technical → ok", () => {
    const r = validateDecisionBody({
      action: "reject",
      reason: "размытие",
      reject_category: "technical",
    });
    expect(r).toEqual({ ok: true, action: "reject", rejectCategory: "technical" });
  });
  it("reject + blocking → ok", () => {
    const r = validateDecisionBody({
      action: "reject",
      reason: "подозрение в подделке",
      reject_category: "blocking",
    });
    expect(r).toEqual({ ok: true, action: "reject", rejectCategory: "blocking" });
  });
  it("reject + мусорная category → bad_category", () => {
    const r = validateDecisionBody({
      action: "reject",
      reason: "x",
      reject_category: "foo" as never,
    });
    expect(r).toEqual({ ok: false, error: "bad_category" });
  });
  it("reject без reason → reason_required", () => {
    const r = validateDecisionBody({ action: "reject", reject_category: "technical" });
    expect(r).toEqual({ ok: false, error: "reason_required" });
  });

  // -------- needs_changes --------
  it("needs_changes без category → ok (category=null)", () => {
    const r = validateDecisionBody({ action: "needs_changes", reason: "переснимите" });
    expect(r).toEqual({ ok: true, action: "needs_changes", rejectCategory: null });
  });
  it("needs_changes + technical → ok (category всё равно null — невалидируется)", () => {
    const r = validateDecisionBody({
      action: "needs_changes",
      reason: "переснимите",
      reject_category: "technical",
    });
    expect(r).toEqual({ ok: true, action: "needs_changes", rejectCategory: null });
  });
  it("needs_changes + blocking → blocking_requires_reject", () => {
    const r = validateDecisionBody({
      action: "needs_changes",
      reason: "x",
      reject_category: "blocking",
    });
    expect(r).toEqual({ ok: false, error: "blocking_requires_reject" });
  });

  // -------- bad action --------
  it("отсутствие action → bad_action", () => {
    const r = validateDecisionBody({});
    expect(r).toEqual({ ok: false, error: "bad_action" });
  });
  it("кривое action → bad_action", () => {
    const r = validateDecisionBody({ action: "delete" as never });
    expect(r).toEqual({ ok: false, error: "bad_action" });
  });
});
