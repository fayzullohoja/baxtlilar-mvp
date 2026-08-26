import { describe, it, expect } from "vitest";
import { extendedBuilderFor, EXTENDED_BUILDERS } from "./section-extended";

/**
 * Здесь проверяются ИМЕНА ПОЛЕЙ внутри секции extended, а не имя секции.
 *
 * Прежний страж (edit-sections.test.ts) сверял только имя секции и потому
 * пропустил настоящую поломку: «модель семьи» кладёт поле схемы
 * family_decision_model под именем decision_model, а редактор писал имя из
 * схемы. Секция совпадала, поле - нет, админка правку не видела, и всё это
 * молча, с ответом ok.
 */

describe("модель семьи: переименование поля", () => {
  const build = extendedBuilderFor("family_model")!;

  it("family_decision_model кладётся как decision_model", () => {
    // Имя, под которым его читает админка (profile-edit-schema.ts).
    const out = build({ family_decision_model: "joint" }, {});
    expect(out.decision_model).toBe("joint");
    expect("family_decision_model" in out).toBe(false);
  });

  it("household_responsibility_model кладётся под своим именем", () => {
    const out = build({ household_responsibility_model: "shared" }, {});
    expect(out.household_responsibility_model).toBe("shared");
  });

  it("не затирает соседние поля секции - там же живут дети", () => {
    // extended.family делят раздел «модель семьи» и раздел «семья».
    const out = build({ family_decision_model: "joint" }, { children: [{ age: 5 }] });
    expect(out.children).toEqual([{ age: 5 }]);
  });

  it("пустое значение не создаёт поле", () => {
    expect("decision_model" in build({}, {})).toBe(false);
  });
});

describe("здоровье: служебные метки приватности", () => {
  const build = extendedBuilderFor("health")!;

  it("всегда помечает секцию как matching_only", () => {
    // Метка задаёт, что эти данные видны только подбору. Редактор её не ставил,
    // и раздел, впервые заполненный правкой, оказывался без пометки.
    expect(build({}, {})._visibility).toBe("matching_only");
  });

  it("зависимость помечается отдельной, более строгой меткой", () => {
    const out = build({ substance_dependency_status: "none" }, {});
    expect(out.substance_dependency_status).toBe("none");
    expect(out.substance_visibility).toBe("safety_only");
  });

  it("готовность обсудить помечается на будущий разбор безопасности", () => {
    const out = build({ substance_dependency_status: "ready_to_discuss" }, {});
    expect(out.later_safety_review).toBe(true);
  });

  it("другие ответы такой отметки не получают", () => {
    expect("later_safety_review" in build({ substance_dependency_status: "none" }, {})).toBe(false);
  });
});

describe("родители: дефолты видимости", () => {
  const build = extendedBuilderFor("parents")!;

  it("проставляет карту видимости полей", () => {
    const v = build({}, {})._visibility as Record<string, string>;
    expect(v.father_status).toBe("matching_only");
    // Возраст родителей скрыт по умолчанию - это не то, что показывают в подборе.
    expect(v.father_age_range).toBe("hidden");
    expect(v.mother_current_location).toBe("hidden");
  });

  it("флаг семейного аддона ставится только на «советуюсь с семьёй»", () => {
    expect(build({ family_involvement: "family_consultation" }, {}).later_offer_family_addon).toBe(true);
    expect(build({ family_involvement: "independent" }, {}).later_offer_family_addon).toBe(false);
  });
});

describe("строители заведены ровно там, где есть правило", () => {
  it("разделы с тривиальной раскладкой строителя не имеют", () => {
    // Заводить строитель без правила значит плодить код, который нечему
    // защищать: общая раскладка по колонкам справляется сама.
    for (const k of ["self", "values", "finance", "lifestyle", "appearance", "marriage", "birth_place", "family", "partner"]) {
      expect(extendedBuilderFor(k), `у раздела ${k} не должно быть строителя`).toBeNull();
    }
  });

  it("строители есть только у трёх разделов с настоящим правилом", () => {
    expect(Object.keys(EXTENDED_BUILDERS).sort()).toEqual(["family_model", "health", "parents"]);
  });

  it("неизвестный раздел строителя не имеет", () => {
    expect(extendedBuilderFor("passport")).toBeNull();
  });
});
