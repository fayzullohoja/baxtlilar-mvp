import { describe, it, expect } from "vitest";
import {
  EDIT_SECTIONS,
  EDIT_SECTION_KEYS,
  isEditSection,
  splitSectionData,
  knownFields,
  fieldsToClear,
} from "./edit-sections";
import { PROFILE_COLUMNS, NON_EDITABLE_COLUMNS } from "./profile-columns";

describe("раскладка полей раздела по колонкам и extended", () => {
  it("поле со своей колонкой едет в колонку, остальное в extended", () => {
    // bio и education - настоящие колонки, specialty - нет (лежит в extended.self).
    const r = splitSectionData({ bio: "текст", education: "higher", specialty: "врач" });
    expect(r.columns).toEqual({ bio: "текст", education: "higher" });
    expect(r.extended).toEqual({ specialty: "врач" });
  });

  it("паспортные поля выбрасываются, даже если пришли в теле запроса", () => {
    // Это и есть граница: клиент может прислать что угодно, а проверка личности
    // не должна обесцениваться правкой анкеты.
    const r = splitSectionData({
      bio: "текст",
      display_name: "Новое Имя",
      birth_date: "1990-01-01",
      gender: "f",
    });
    expect(r.columns).toEqual({ bio: "текст" });
    expect(r.extended).toEqual({});
  });

  it("служебные поля тоже выбрасываются - иначе статус ставили бы из браузера", () => {
    const r = splitSectionData({
      bio: "текст",
      status: "published",
      needs_marital_review: false,
      needs_v4_review: false,
      published_at: "2020-01-01",
      profile_visibility_mode: "all",
    });
    expect(r.columns).toEqual({ bio: "текст" });
    expect(r.extended).toEqual({});
  });

  it("undefined не затирает уже сохранённое значение", () => {
    // Пришло поле без значения - его в патче быть не должно, иначе
    // необязательное поле формы обнуляло бы то, что человек ввёл раньше.
    const r = splitSectionData({ bio: "текст", education: undefined });
    expect("education" in r.columns).toBe(false);
    expect("education" in r.extended).toBe(false);
  });

  it("null сохраняется - это осознанная очистка поля", () => {
    // Отличие от undefined принципиально: null значит «убрать значение».
    const r = splitSectionData({ employment_format: null });
    expect(r.columns).toEqual({ employment_format: null });
  });

  it("ничего запрещённого не может просочиться в колонки", () => {
    const everything = Object.fromEntries([...PROFILE_COLUMNS].map((c) => [c, "x"]));
    const r = splitSectionData(everything);
    for (const forbidden of NON_EDITABLE_COLUMNS) {
      expect(forbidden in r.columns).toBe(false);
    }
  });

  it("extended никогда не попадает в колонки как поле раздела", () => {
    // Иначе раздел мог бы затереть JSON-блок целиком со всеми чужими секциями.
    const r = splitSectionData({ extended: { hacked: true }, bio: "текст" });
    expect(r.columns).toEqual({ bio: "текст" });
  });
});

describe("реестр разделов", () => {
  it("у каждого раздела есть схема и имя секции в extended", () => {
    for (const k of EDIT_SECTION_KEYS) {
      expect(EDIT_SECTIONS[k].schema).toBeTruthy();
      expect(typeof EDIT_SECTIONS[k].extendedKey).toBe("string");
      expect(EDIT_SECTIONS[k].extendedKey.length).toBeGreaterThan(0);
    }
  });

  it("«модель семьи» и «семья» делят секцию extended.family - как в анкете", () => {
    // Общий ключ здесь НЕ ошибка: ручки анкеты family-model и family обе пишут
    // в extended.family, просто разные поля (модель решений против детей).
    // Правка одного раздела не трогает поля другого, потому что очистка по
    // отсутствию ограничена полями собственной схемы раздела.
    expect(EDIT_SECTIONS.family_model.extendedKey).toBe("family");
    expect(EDIT_SECTIONS.family.extendedKey).toBe("family");
    const fmFields = new Set(knownFields("family_model"));
    const famFields = knownFields("family");
    expect(famFields.some((f) => fmFields.has(f))).toBe(false);
  });

  it("остальные разделы не делят секции extended между собой", () => {
    const keys = EDIT_SECTION_KEYS.filter((k) => k !== "family_model").map(
      (k) => EDIT_SECTIONS[k].extendedKey,
    );
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("чужое имя раздела не принимается", () => {
    expect(isEditSection("self")).toBe(true);
    expect(isEditSection("passport")).toBe(false);
    expect(isEditSection("")).toBe(false);
    expect(isEditSection(null)).toBe(false);
  });

  it("схема раздела действительно отбивает мусор", () => {
    // Проверяем, что реестр подключил РАБОЧУЮ схему, а не пустой объект: иначе
    // валидация была бы декоративной.
    const bad = EDIT_SECTIONS.self.schema.safeParse({ bio: "коротко" });
    expect(bad.success).toBe(false);
  });

  it("фильтр контактов работает и в правке, не только в анкете", () => {
    // Схемы те же, значит телефон в тексте о себе отбивается сервером.
    const withPhone = EDIT_SECTIONS.self.schema.safeParse({
      bio: "Меня зовут Али, пишите мне на +998 90 123 45 67, отвечу быстро и с удовольствием",
      education: "higher",
      activity_field: "it",
      employment_status: "employed",
    });
    expect(withPhone.success).toBe(false);
  });
});

describe("ключи extended заморожены по факту, а не по догадке", () => {
  /**
   * Куда РЕАЛЬНО пишет ручка анкеты каждого раздела. Снято чтением исходников
   * ручек 2026-08-25 (grep по stampExtended/extended.<ключ>), а не выведено из
   * имени раздела - именно догадка по имени и дала две ошибки: «модель семьи»
   * пишет в family, а не family_model, «внешность» в langs, а не appearance.
   *
   * Ошибка тихая: сохранение отвечает ok, а прочитать значение потом неоткуда.
   * Поэтому значения зафиксированы здесь списком: сдвинуть их можно только
   * осознанно, вместе с этим тестом.
   */
  const REAL_KEYS: Record<string, string> = {
    self: "self",
    values: "values",
    family_model: "family",
    finance: "finance",
    lifestyle: "lifestyle",
    health: "health",
    appearance: "langs",
    parents: "parents",
    birth_place: "birth_place",
    marriage: "marriage",
    family: "family",
    partner: "partner",
  };

  it("каждый раздел пишет туда же, куда ручка анкеты", () => {
    for (const k of EDIT_SECTION_KEYS) {
      expect(EDIT_SECTIONS[k].extendedKey, `раздел ${k}`).toBe(REAL_KEYS[k]);
    }
  });

  it("список разделов и список проверенных ключей совпадают", () => {
    // Добавили раздел и забыли сверить его ключ с ручкой - тест упадёт здесь.
    expect([...EDIT_SECTION_KEYS].sort()).toEqual(Object.keys(REAL_KEYS).sort());
  });
});

describe("зачистка полей с отпавшим условием", () => {
  it("«дохода нет» стирает сохранённый ранее размер дохода", () => {
    // Та самая ловушка family launch: клиент прячет вопрос и перестаёт слать
    // поле, а прежний диапазон переживает отказ и остаётся в базе.
    expect(fieldsToClear("finance", { income_source_stability: "none" })).toContain(
      "monthly_income_range",
    );
    expect(fieldsToClear("finance", { income_source_stability: "stable" })).toEqual([]);
  });

  it("«детей нет» стирает список детей и с кем они живут", () => {
    const cleared = fieldsToClear("family", { has_children: "no", marital_status: "never" });
    expect(cleared).toContain("children");
    expect(cleared).toContain("children_living");
  });

  it("при наличии детей список не стирается", () => {
    const cleared = fieldsToClear("family", { has_children: "yes", marital_status: "never" });
    expect(cleared).not.toContain("children");
  });

  it("«сколько раз в браке» спрашивают только у разведённых", () => {
    expect(fieldsToClear("family", { marital_status: "never" })).toContain("previous_marriages");
    expect(fieldsToClear("family", { marital_status: "divorced" })).not.toContain(
      "previous_marriages",
    );
  });

  it("разделы без условных полей ничего не чистят", () => {
    for (const k of ["self", "values", "health", "parents", "partner"] as const) {
      expect(fieldsToClear(k, {})).toEqual([]);
    }
  });
});

describe("поля схемы раздела", () => {
  it("известны и для обычных схем, и для схем с проверками", () => {
    // partnerExtendedSchema обёрнута в .refine - у неё .shape лежит глубже, и
    // без учёта этого список полей вышел бы пустым, а очистка по отсутствию
    // молча перестала бы работать именно там, где важнее всего.
    expect(knownFields("self")).toContain("specialty");
    expect(knownFields("partner").length).toBeGreaterThan(0);
    expect(knownFields("family").length).toBeGreaterThan(0);
    for (const k of EDIT_SECTION_KEYS) {
      expect(knownFields(k).length, `у раздела ${k} пустой список полей`).toBeGreaterThan(0);
    }
  });
});
