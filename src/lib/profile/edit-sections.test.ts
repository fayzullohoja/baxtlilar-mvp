import { describe, it, expect } from "vitest";
import {
  EDIT_SECTIONS,
  EDIT_SECTION_KEYS,
  isEditSection,
  splitSectionData,
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

  it("имена секций в extended не повторяются", () => {
    // Два раздела с одним именем затирали бы данные друг друга.
    const keys = EDIT_SECTION_KEYS.map((k) => EDIT_SECTIONS[k].extendedKey);
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
