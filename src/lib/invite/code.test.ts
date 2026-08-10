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

  // Критичные тесты логики приоритизации: они должны упасть, если заменить
  // extractInviteCode на простую normalizeInviteCode всей строки.
  describe("приоритизация: слово-ловушка не должна заменять настоящий код", () => {
    it("отклоняет слово-ловушку перед кодом (Секрет: 7K2MQX)", () => {
      // "Секрет" после нормализации даёт "CEKPET" (6 символов) - точная ловушка.
      // Если применить normalizeInviteCode ко всей строке, получим CEKPET7K2MQX,
      // и первые 6 символов (CEKPET) будут ошибочно выбраны.
      // extractInviteCode должна найти "7K2MQX" через двухпроходный поиск.
      expect(extractInviteCode("Секрет: 7K2MQX")).toBe("7K2MQX");
    });

    it("отклоняет слово-ловушку перед кодом (Маркет 7K2MQX)", () => {
      // "Маркет" слегка отличается - даёт "MPKET" (5 символов) после нормализации,
      // но всё равно занимает начало и может вызвать путаницу в наивной реализации.
      // Проверяем, что находим настоящий код.
      expect(extractInviteCode("Маркет 7K2MQX")).toBe("7K2MQX");
    });

    it("честно отказывает, если соседнее слово подмешается вместо кода", () => {
      // "А 7K2MQ" при наивной нормализации даст "A7K2MQ" (6 символов) - буква А
      // из соседнего слова подмешалась. extractInviteCode должна понять, что это
      // попытка выжать 6 символов из мусора, и вернуть пустую строку.
      expect(extractInviteCode("А 7K2MQ")).toBe("");
    });

    it("находит код на кириллице внутри фразы (нет слова-ловушки)", () => {
      // "ВХТЕКМ" на кириллице требует замены и даёт "BXTEKM" (6 символов).
      // Через двухпроходный поиск это найдётся во втором проходе.
      expect(extractInviteCode("Держи ВХТЕКМ заходи")).toBe("BXTEKM");
    });

    it("приоритет: код без замен выигрывает у кода с заменами", () => {
      // В одной строке есть слово, которое требует замены, и настоящий код.
      // Настоящий код (без замен) должен выиграть в приоритете.
      expect(extractInviteCode("Секрет 7K2MQX")).toBe("7K2MQX");
    });
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
