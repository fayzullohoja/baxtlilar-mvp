import { describe, it, expect } from "vitest";
import { optLabel, optLabelOf, type OptTranslator } from "./option-label";
import { MARITAL_STATUS, RELIGION } from "./options";
import type { Opt } from "./options";

/** Фейковый переводчик namespace `Options` поверх заданного словаря. */
function fakeT(dict: Record<string, string>): OptTranslator {
  const t = ((key: string) => dict[key] ?? key) as OptTranslator;
  t.has = (key: string) => Object.hasOwn(dict, key);
  return t;
}

const never = MARITAL_STATUS.find((o) => o.value === "never")!;
const islam = RELIGION.find((o) => o.value === "islam")!;

describe("optLabel — порядок разрешения лейбла варианта", () => {
  it("группа проштампована (иначе ключ не построить)", () => {
    expect(never.group).toBe("MARITAL_STATUS");
    expect(islam.group).toBe("RELIGION");
  });

  it("1) редактируемый ГЕНДЕРНЫЙ ключ побеждает всё", () => {
    const t = fakeT({
      "MARITAL_STATUS.never": "нейтральный",
      "MARITAL_STATUS.never__m": "ОТРЕДАКТИРОВАННЫЙ М",
    });
    expect(optLabel(t, never, "ru", "m")).toBe("ОТРЕДАКТИРОВАННЫЙ М");
  });

  it("2) нейтральный ключ — когда пола нет", () => {
    const t = fakeT({ "MARITAL_STATUS.never": "нейтральный" });
    expect(optLabel(t, never, "ru", null)).toBe("нейтральный");
  });

  it("2b) нейтральный ключ — когда пол есть, но гендерного ключа нет", () => {
    const t = fakeT({ "RELIGION.islam": "Ислам (правл.)" });
    expect(optLabel(t, islam, "ru", "f")).toBe("Ислам (правл.)");
  });

  it("3) нет ключей → код-оверрайд по полу (страховка)", () => {
    const t = fakeT({}); // ключей нет вовсе
    expect(optLabel(t, never, "ru", "m")).toBe("Холост");
    expect(optLabel(t, never, "ru", "f")).toBe("Не была в браке");
    expect(optLabel(t, never, "uz", "m")).toBe("Boʻydoq");
  });

  it("4) нет ключей и нет пола → базовый ru/uz из options.ts (НЕ сырой ключ)", () => {
    const t = fakeT({});
    expect(optLabel(t, islam, "ru")).toBe(islam.ru);
    expect(optLabel(t, islam, "uz")).toBe(islam.uz);
  });

  it("непроштампованный Opt (без group) → базовый лейбл, без падения", () => {
    const orphan: Opt = { value: "x", ru: "Икс", uz: "Iks" };
    const t = fakeT({ "X.x": "не должно примениться" });
    expect(optLabel(t, orphan, "ru")).toBe("Икс");
  });
});

describe("optLabelOf — поиск по значению", () => {
  it("возвращает лейбл найденного варианта", () => {
    const t = fakeT({ "RELIGION.islam": "Ислам!" });
    expect(optLabelOf(t, RELIGION, "islam", "ru")).toBe("Ислам!");
  });
  it("неизвестное значение отдаётся как есть (как в labelOf)", () => {
    expect(optLabelOf(fakeT({}), RELIGION, "no_such_value", "ru")).toBe("no_such_value");
  });
});
