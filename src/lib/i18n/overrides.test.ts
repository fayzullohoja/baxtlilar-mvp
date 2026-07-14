import { describe, it, expect } from "vitest";
import {
  applyOverride,
  flattenStrings,
  extractArgs,
  extractTags,
  validatePlaceholders,
  validateIcuStructure,
  validateOverrideText,
} from "./overrides";
import ru from "../../../messages/ru.json";
import uz from "../../../messages/uz.json";
import en from "../../../messages/en.json";
import tr from "../../../messages/tr.json";

describe("applyOverride — fail-safe наложение", () => {
  it("заменяет существующий строковый лист (вложенный путь)", () => {
    const root = { Anketa: { selfTitle: "Оригинал", other: "keep" } };
    expect(applyOverride(root, "Anketa.selfTitle", "Новый")).toBe(true);
    expect(root.Anketa.selfTitle).toBe("Новый");
    expect(root.Anketa.other).toBe("keep"); // сосед сохранён
  });

  it("НЕ создаёт новый ключ (несуществующий лист → false)", () => {
    const root = { A: { b: "x" } } as Record<string, unknown>;
    expect(applyOverride(root, "A.nope", "y")).toBe(false);
    expect((root.A as Record<string, unknown>).nope).toBeUndefined();
  });

  it("НЕ перезаписывает не-строку (объект/массив)", () => {
    const root = { A: { obj: { deep: "x" }, arr: ["a"] } };
    expect(applyOverride(root, "A.obj", "boom")).toBe(false);
    expect(applyOverride(root, "A.arr", "boom")).toBe(false);
    expect(root.A.obj).toEqual({ deep: "x" });
    expect(root.A.arr).toEqual(["a"]);
  });

  it("НЕ спускается сквозь не-объект в середине пути", () => {
    const root = { A: { s: "str" } };
    expect(applyOverride(root, "A.s.x", "y")).toBe(false);
  });

  it("отвергает proto-сегменты и не загрязняет Object.prototype", () => {
    const root = {} as Record<string, unknown>;
    expect(applyOverride(root, "__proto__.polluted", "yes")).toBe(false);
    expect(applyOverride(root, "constructor.prototype.polluted", "yes")).toBe(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(({} as any).polluted).toBeUndefined();
  });

  it("отвергает пустые сегменты", () => {
    const root = { A: { b: "x" } };
    expect(applyOverride(root, "A..b", "y")).toBe(false);
    expect(applyOverride(root, "", "y")).toBe(false);
  });
});

describe("flattenStrings — только строковые листья", () => {
  it("собирает dotted-ключи строк, исключая массивы/числа/объекты-как-значения", () => {
    const flat = flattenStrings({
      A: { title: "T", sub: "S", count: 3, list: ["x", "y"], nested: { k: "v" } },
      B: "top",
    });
    expect(flat).toEqual({
      "A.title": "T",
      "A.sub": "S",
      "A.nested.k": "v",
      B: "top",
    });
    expect(flat["A.count"]).toBeUndefined();
    expect(flat["A.list"]).toBeUndefined();
  });

  it("пропускает proto-ключи", () => {
    const evil = JSON.parse('{"__proto__":{"x":"1"},"ok":"2"}');
    const flat = flattenStrings(evil);
    expect(flat.ok).toBe("2");
    expect(Object.keys(flat).some((k) => k.includes("__proto__"))).toBe(false);
  });
});

describe("extractArgs / extractTags", () => {
  it("ловит простые {arg}", () => {
    expect([...extractArgs("Привет, {name}! Тебе {age}.")].sort()).toEqual(["age", "name"]);
  });
  it("ловит аргумент ICU-plural, но не ветки", () => {
    expect([...extractArgs("{count, plural, one {# год} other {# лет}}")]).toEqual(["count"]);
  });
  it("пустая строка без аргументов", () => {
    expect(extractArgs("просто текст").size).toBe(0);
  });
  it("ловит rich-теги", () => {
    expect([...extractTags("Нажми <link>сюда</link> и <b>жирный</b>")].sort()).toEqual(["b", "link"]);
  });
});

describe("validatePlaceholders — write-time защита", () => {
  it("совпадающий набор аргументов → ok (перефраз разрешён)", () => {
    expect(validatePlaceholders("Привет, {name}", "{name}, здравствуйте").ok).toBe(true);
  });
  it("потерянный аргумент → ошибка", () => {
    const r = validatePlaceholders("Привет, {name}", "Привет");
    expect(r.ok).toBe(false);
  });
  it("лишний аргумент → ошибка", () => {
    const r = validatePlaceholders("Привет", "Привет, {name}");
    expect(r.ok).toBe(false);
  });
  it("несовпадение тегов → ошибка", () => {
    const r = validatePlaceholders("<b>x</b>", "<i>x</i>");
    expect(r.ok).toBe(false);
  });
  it("совпадающие теги и аргументы → ok", () => {
    expect(validatePlaceholders("<b>{n}</b>", "<b>значение {n}</b>").ok).toBe(true);
  });
});

describe("validateIcuStructure — ловит поломки ICU, которые проходят set-equality", () => {
  it("валидные строки проходят", () => {
    for (const s of [
      "Просто текст",
      "Привет, {name}!",
      "{count, plural, one {# год} other {# лет}}",
      "<b>жирный</b> и <link>ссылка</link>",
      "Ma'lumot yo'q", // узбекский апостроф (не ICU-escape)
      "Литеральная '{' скобка", // ICU-escape
      "Апостроф '' внутри",
    ]) {
      expect(validateIcuStructure(s), s).toEqual({ ok: true });
    }
  });
  it("незакрытая { → ошибка (демонстрированный баг)", () => {
    expect(validateIcuStructure("СЛОМАННЫЙ { тест").ok).toBe(false);
  });
  it("лишняя } → ошибка", () => {
    expect(validateIcuStructure("текст } хвост").ok).toBe(false);
  });
  it("несбалансированный тег → ошибка", () => {
    expect(validateIcuStructure("<b>без закрытия").ok).toBe(false);
    expect(validateIcuStructure("<b>x</i>").ok).toBe(false);
  });
  it("validateOverrideText комбинирует: плейсхолдер ок, но структура сломана → ошибка", () => {
    // тот же набор аргументов ({} == {}), но незакрытая скобка
    expect(validateOverrideText("Текст", "Текст {").ok).toBe(false);
    // всё валидно → ok
    expect(validateOverrideText("Привет, {name}", "{name}, привет").ok).toBe(true);
  });
});

describe("SAFETY SWEEP — валидатор не должен ложно отвергать НИ ОДНУ базовую строку", () => {
  const locales = { ru, uz, en, tr } as Record<string, unknown>;
  for (const [loc, msgs] of Object.entries(locales)) {
    it(`все строки ${loc}.json проходят validateIcuStructure`, () => {
      const flat = flattenStrings(msgs);
      const bad: string[] = [];
      for (const [k, v] of Object.entries(flat)) {
        if (!validateIcuStructure(v).ok) bad.push(`${k} = ${JSON.stringify(v)}`);
      }
      expect(bad, `ложно отвергнутые строки:\n${bad.join("\n")}`).toEqual([]);
    });
  }
});
