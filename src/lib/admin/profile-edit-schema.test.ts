import { describe, it, expect } from "vitest";
import { PROFILE_EDIT_SECTIONS, EDIT_FIELD_BY_KEY } from "./profile-edit-schema";

const allFields = PROFILE_EDIT_SECTIONS.flatMap((s) => s.fields);

describe("profile-edit registry (admin anketa editor)", () => {
  // БЕЗОПАСНОСТЬ: паспортные и авто-выводимые поля НЕ должны быть редактируемы
  // из общего редактора (whitelist = единственная защита от mass-assignment).
  it("НЕ содержит паспортных / авто-полей", () => {
    for (const forbidden of ["gender", "birth_date", "looking_for_gender", "youngest_child_age"]) {
      expect(EDIT_FIELD_BY_KEY[forbidden], `${forbidden} не должен быть редактируемым`).toBeUndefined();
    }
  });

  it("ключи уникальны (flat-мапа не теряет полей)", () => {
    expect(Object.keys(EDIT_FIELD_BY_KEY).length).toBe(allFields.length);
  });

  it("select/multiselect имеют непустые опции", () => {
    for (const f of allFields) {
      if (f.kind === "select" || f.kind === "multiselect") {
        expect(f.options && f.options.length > 0, `${f.key}: пустые опции`).toBe(true);
      }
    }
  });

  it("cold-поля ссылаются на известную секцию extended", () => {
    const known = new Set(["finance", "lifestyle", "health", "family", "living", "bio", "partner"]);
    for (const f of allFields) {
      if (f.cold) expect(known.has(f.cold), `${f.key}: неизвестная cold-секция ${f.cold}`).toBe(true);
    }
  });

  it("number-поля имеют вменяемый диапазон min<=max", () => {
    for (const f of allFields) {
      if (f.kind === "number" && f.min != null && f.max != null) {
        expect(f.min).toBeLessThanOrEqual(f.max);
      }
    }
  });
});
