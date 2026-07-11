import { describe, it, expect } from "vitest";
import {
  selfSchema,
  familyChildrenSchema,
  valuesV3Schema,
  familyModelSchema,
  partnerExtendedSchema,
  privacySchema,
} from "./schemas";

// =============================================================================
// Экран 3 — selfSchema
// =============================================================================

describe("V3 selfSchema (Экран 3)", () => {
  const ok = {
    bio: "Я спокойный человек, ценю семью и честность. Люблю готовить и путешествовать.",
    education: "higher",
    activity_field: "it_software",
    employment_status: "working",
    employment_format: "remote",
  };

  it("принимает полный валидный payload", () => {
    expect(selfSchema.safeParse(ok).success).toBe(true);
  });

  it("отклоняет bio < 20 символов", () => {
    expect(
      selfSchema.safeParse({ ...ok, bio: "коротко" }).success,
    ).toBe(false);
  });

  it("отклоняет bio с контактом (телефон)", () => {
    expect(
      selfSchema.safeParse({
        ...ok,
        bio: "Звони мне 998901234567 я хороший человек тут есть всё нужное",
      }).success,
    ).toBe(false);
  });

  it("отклоняет неверный activity_field", () => {
    expect(
      selfSchema.safeParse({ ...ok, activity_field: "space_exploration" }).success,
    ).toBe(false);
  });

  it("отклоняет неверный employment_format", () => {
    expect(
      selfSchema.safeParse({ ...ok, employment_format: "freelance" }).success,
    ).toBe(false);
  });
});

// =============================================================================
// Экран 5 — familyChildrenSchema
// =============================================================================

describe("V3 familyChildrenSchema (Экран 5)", () => {
  const ok = {
    marital_status: "never",
    has_children: "no",
    future_children_plan: "yes_later",
  };

  it("принимает базовый payload без count/age", () => {
    expect(familyChildrenSchema.safeParse(ok).success).toBe(true);
  });

  it("принимает с children_count + youngest_child_age", () => {
    expect(
      familyChildrenSchema.safeParse({
        ...ok,
        has_children: "yes",
        children_count: 2,
        youngest_child_age: 5,
      }).success,
    ).toBe(true);
  });

  it("отклоняет children_count > 10", () => {
    expect(
      familyChildrenSchema.safeParse({ ...ok, children_count: 11 }).success,
    ).toBe(false);
  });

  it("отклоняет youngest_child_age > 50", () => {
    expect(
      familyChildrenSchema.safeParse({ ...ok, youngest_child_age: 51 }).success,
    ).toBe(false);
  });

  it("отклоняет неверный future_children_plan", () => {
    expect(
      familyChildrenSchema.safeParse({ ...ok, future_children_plan: "definitely" }).success,
    ).toBe(false);
  });
});

// =============================================================================
// Экран 6 — valuesV3Schema
// =============================================================================

describe("V3 valuesV3Schema (Экран 6)", () => {
  const ok = {
    religion: "islam",
    religion_practice: "striving",
    top_life_values: ["family", "education"],
  };

  it("принимает 1-3 top_life_values", () => {
    expect(valuesV3Schema.safeParse(ok).success).toBe(true);
  });

  it("принимает с religion_partner_match опционально", () => {
    expect(
      valuesV3Schema.safeParse({
        ...ok,
        religion_partner_match: "same_religion",
      }).success,
    ).toBe(true);
  });

  it("отклоняет 4 top_life_values", () => {
    expect(
      valuesV3Schema.safeParse({
        ...ok,
        top_life_values: ["family", "education", "honesty", "career"],
      }).success,
    ).toBe(false);
  });

  it("отклоняет 0 top_life_values", () => {
    expect(
      valuesV3Schema.safeParse({ ...ok, top_life_values: [] }).success,
    ).toBe(false);
  });

  it("отклоняет неверный religion_practice", () => {
    expect(
      valuesV3Schema.safeParse({ ...ok, religion_practice: "agnostic" }).success,
    ).toBe(false);
  });
});

// =============================================================================
// Экран 7 — familyModelSchema
// =============================================================================

describe("V3 familyModelSchema (Экран 7)", () => {
  const ok = {
    family_role_model: "traditional",
    wife_work_after_marriage_view: "ok_if_needed",
  };

  it("принимает только required поля", () => {
    expect(familyModelSchema.safeParse(ok).success).toBe(true);
  });

  it("принимает с cold-полями (decision/household)", () => {
    expect(
      familyModelSchema.safeParse({
        ...ok,
        family_decision_model: "joint",
        household_responsibility_model: "shared_50_50",
      }).success,
    ).toBe(true);
  });

  it("отклоняет неверный family_role_model", () => {
    expect(
      familyModelSchema.safeParse({ ...ok, family_role_model: "matriarchy" }).success,
    ).toBe(false);
  });

  it("отклоняет неверный wife_work_after_marriage_view", () => {
    expect(
      familyModelSchema.safeParse({
        ...ok,
        wife_work_after_marriage_view: "must_work",
      }).success,
    ).toBe(false);
  });
});

// =============================================================================
// Экран 8 — partnerExtendedSchema
// =============================================================================

describe("V3 partnerExtendedSchema (Экран 8)", () => {
  const ok = {
    partner_age_min: 25,
    partner_age_max: 35,
    partner_top_qualities: ["kindness", "honesty"],
  };

  it("принимает только required поля", () => {
    expect(partnerExtendedSchema.safeParse(ok).success).toBe(true);
  });

  it("принимает с partner_height_min/max", () => {
    expect(
      partnerExtendedSchema.safeParse({
        ...ok,
        partner_height_min: 160,
        partner_height_max: 175,
      }).success,
    ).toBe(true);
  });

  it("отклоняет partner_age_max < partner_age_min", () => {
    expect(
      partnerExtendedSchema.safeParse({
        ...ok,
        partner_age_min: 35,
        partner_age_max: 25,
      }).success,
    ).toBe(false);
  });

  it("отклоняет partner_height_max < partner_height_min", () => {
    expect(
      partnerExtendedSchema.safeParse({
        ...ok,
        partner_height_min: 180,
        partner_height_max: 160,
      }).success,
    ).toBe(false);
  });

  it("отклоняет partner_height вне диапазона", () => {
    expect(
      partnerExtendedSchema.safeParse({
        ...ok,
        partner_height_min: 100,
        partner_height_max: 110,
      }).success,
    ).toBe(false);
  });

  it("отклоняет 0 partner_top_qualities", () => {
    expect(
      partnerExtendedSchema.safeParse({ ...ok, partner_top_qualities: [] }).success,
    ).toBe(false);
  });

  it("отклоняет 6 partner_top_qualities (max 5)", () => {
    expect(
      partnerExtendedSchema.safeParse({
        ...ok,
        partner_top_qualities: [
          "kindness",
          "honesty",
          "responsibility",
          "intelligence",
          "sense_of_humor",
          "calmness",
        ],
      }).success,
    ).toBe(false);
  });

  it("отклоняет неверное качество", () => {
    expect(
      partnerExtendedSchema.safeParse({
        ...ok,
        partner_top_qualities: ["telepathy"],
      }).success,
    ).toBe(false);
  });

  it("принимает partner_hard_criteria (hard/soft-переключатель)", () => {
    expect(
      partnerExtendedSchema.safeParse({
        ...ok,
        partner_hard_criteria: ["religion", "marital"],
      }).success,
    ).toBe(true);
  });

  it("отклоняет неверный hard-критерий", () => {
    expect(
      partnerExtendedSchema.safeParse({
        ...ok,
        partner_hard_criteria: ["telepathy"],
      }).success,
    ).toBe(false);
  });
});

// =============================================================================
// Экран 16 — privacySchema
// =============================================================================

describe("V3 privacySchema (Экран 16)", () => {
  it("принимает 'public'", () => {
    expect(
      privacySchema.safeParse({ profile_visibility_mode: "public" }).success,
    ).toBe(true);
  });

  it("принимает 'verified_only'", () => {
    expect(
      privacySchema.safeParse({ profile_visibility_mode: "verified_only" }).success,
    ).toBe(true);
  });

  it("принимает 'by_request'", () => {
    expect(
      privacySchema.safeParse({ profile_visibility_mode: "by_request" }).success,
    ).toBe(true);
  });

  it("отклоняет неверный mode", () => {
    expect(
      privacySchema.safeParse({ profile_visibility_mode: "private" }).success,
    ).toBe(false);
  });

  it("отклоняет пустой объект", () => {
    expect(privacySchema.safeParse({}).success).toBe(false);
  });
});
