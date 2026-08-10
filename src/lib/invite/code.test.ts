import { describe, it, expect } from "vitest";
import {
  normalizeInviteCode,
  extractInviteCode,
  generateInviteCode,
  INVITE_CODE_ALPHABET,
  INVITE_CODE_LENGTH,
} from "./code";

describe("normalizeInviteCode", () => {
  it("поднимает регистр", () => {
    expect(normalizeInviteCode("7k2mqx")).toBe("7K2MQX");
  });

  it("убирает пробелы и дефисы", () => {
    expect(normalizeInviteCode(" 7K2 - MQX ")).toBe("7K2MQX");
  });

  // Главный кейс: в Узбекистане печатают на кириллице, а кириллические
  // В А Е К М Н О Р С Т У Х визуально НЕОТЛИЧИМЫ от латинских.
  it("переводит похожие кириллические буквы в латиницу", () => {
    expect(normalizeInviteCode("ВАХТ7К2М")).toBe("BAXT7K2M");
  });

  it("переводит кириллицу в нижнем регистре", () => {
    expect(normalizeInviteCode("вахт7к2м")).toBe("BAXT7K2M");
  });

  it("выбрасывает всё, чего нет в алфавите", () => {
    expect(normalizeInviteCode("7K2@MQX!")).toBe("7K2MQX");
    expect(normalizeInviteCode("散")).toBe("");
  });

  it("не падает на пустой строке и мусоре", () => {
    expect(normalizeInviteCode("")).toBe("");
    expect(normalizeInviteCode("   ")).toBe("");
    expect(normalizeInviteCode("привет")).toBe("PBET"); // п,р,и,в,е,т -> Р и В Е Т, из них в алфавите B E T + P
  });

  // Каждая пара кириллицы должна быть покрыта отдельным тестом, чтобы
  // обнаружить любую подмену в карте. Самая опасная: У → Y (ожидают У → U).
  describe("карта кириллицы - каждая пара", () => {
    const cyrillicPairs: [string, string][] = [
      ["А", "A"],
      ["В", "B"],
      ["Е", "E"],
      ["К", "K"],
      ["М", "M"],
      ["Н", "H"],
      ["Р", "P"],
      ["С", "C"],
      ["Т", "T"],
      ["У", "Y"],
      ["Х", "X"],
    ];

    for (const [cyrillic, latin] of cyrillicPairs) {
      it(`переводит ${cyrillic} в ${latin} (верхний регистр)`, () => {
        expect(normalizeInviteCode(cyrillic)).toBe(latin);
      });

      it(`переводит ${cyrillic.toLowerCase()} в ${latin} (нижний регистр)`, () => {
        expect(normalizeInviteCode(cyrillic.toLowerCase())).toBe(latin);
      });
    }
  });
});

describe("extractInviteCode", () => {
  it("чистый код без окружения работает как раньше", () => {
    expect(extractInviteCode("7K2MQX")).toBe("7K2MQX");
  });

  it("извлекает код внутри русской фразы", () => {
    expect(extractInviteCode("Держи код: 7K2MQX, заходи")).toBe("7K2MQX");
  });

  it("извлекает код внутри узбекской фразы", () => {
    expect(extractInviteCode("Kod: 7K2MQX ni kiriting")).toBe("7K2MQX");
  });

  it("извлекает код, разбитый пробелом", () => {
    expect(extractInviteCode("7K2 MQX")).toBe("7K2MQX");
  });

  it("извлекает код с дефисом", () => {
    expect(extractInviteCode("7K2-MQX")).toBe("7K2MQX");
  });

  it("возвращает пустую строку если кода нет", () => {
    expect(extractInviteCode("никакого кода тут нет")).toBe("");
  });

  it("не мешает неразрывный пробел вокруг кода", () => {
    expect(extractInviteCode(" 7K2MQX ")).toBe("7K2MQX");
  });

  it("не мешает zero-width space вокруг кода", () => {
    expect(extractInviteCode("​7K2MQX​")).toBe("7K2MQX");
  });
});

describe("generateInviteCode", () => {
  it("длина равна константе INVITE_CODE_LENGTH", () => {
    expect(INVITE_CODE_LENGTH).toBe(6);
  });

  it("длина сгенерированного кода совпадает с константой", () => {
    expect(generateInviteCode()).toHaveLength(INVITE_CODE_LENGTH);
  });

  it("использует только символы алфавита", () => {
    for (let i = 0; i < 200; i++) {
      for (const ch of generateInviteCode()) {
        expect(INVITE_CODE_ALPHABET).toContain(ch);
      }
    }
  });

  it("в алфавите нет похожих символов (0/O, 1/I/L)", () => {
    for (const ch of "01ILO") {
      expect(INVITE_CODE_ALPHABET).not.toContain(ch);
    }
  });

  it("сгенерированный код проходит нормализацию без изменений", () => {
    for (let i = 0; i < 50; i++) {
      const c = generateInviteCode();
      expect(normalizeInviteCode(c)).toBe(c);
    }
  });
});
