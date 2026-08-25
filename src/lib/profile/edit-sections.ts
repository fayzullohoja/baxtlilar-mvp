import { z } from "zod";
import {
  selfSchema,
  valuesV3Schema,
  familyModelSchema,
  financeSchema,
  lifestyleSchema,
  healthSchema,
  appearanceSchema,
  parentsSchema,
  birthPlaceSchema,
  marriageSchema,
  familyChildrenSchema,
  partnerExtendedSchema,
} from "./schemas";
import { PROFILE_COLUMNS, NON_EDITABLE_COLUMNS } from "./profile-columns";
import { shouldAskIncomeRange } from "./finance-visibility";

/**
 * Разделы, которые человек может править в своём профиле.
 *
 * Зачем это вообще. До сих пор изменить в анкете нельзя было НИЧЕГО: экран
 * настроек честно писал «Edit-flow для анкеты - пока редиректит в re-flow
 * онбординга (TODO Sprint 16)». Человек, переехавший в другой город или
 * сменивший работу, оставался с устаревшей анкетой навсегда.
 *
 * Что править НЕЛЬЗЯ и почему - см. NON_EDITABLE_COLUMNS. Коротко: паспортные
 * поля правит только поддержка (иначе проверка личности ничего не значит), а
 * служебными распоряжается машина состояний.
 *
 * Раскладка полей по колонкам и по JSON-блоку extended НЕ прописана здесь
 * руками: она выводится из настоящего списка колонок таблицы. Руками её пишут
 * девять ручек анкеты, и десятая копия неизбежно бы с ними разошлась.
 */

export type EditSectionKey =
  | "self"
  | "values"
  | "family_model"
  | "finance"
  | "lifestyle"
  | "health"
  | "appearance"
  | "parents"
  | "birth_place"
  | "marriage"
  | "family"
  | "partner";

type SectionDef = {
  schema: z.ZodTypeAny;
  /** Имя секции внутри extended. Поля без своей колонки едут туда. */
  extendedKey: string;
};

/**
 * ВНИМАНИЕ: extendedKey обязан совпадать с тем, куда пишет ручка анкеты того же
 * раздела. Здесь это уже было сломано дважды - «модель семьи» пишет в
 * extended.family, а не family_model, а «внешность» в extended.langs, а не
 * appearance. Ошибка тихая: сохранение проходит успешно, а прочитать значение
 * потом неоткуда. Соответствие закреплено тестом edit-vs-anketa.itest.ts,
 * который сохраняет одну и ту же посылку обоими путями и сверяет состояние базы.
 */
export const EDIT_SECTIONS: Record<EditSectionKey, SectionDef> = {
  self: { schema: selfSchema, extendedKey: "self" },
  values: { schema: valuesV3Schema, extendedKey: "values" },
  // ручка анкеты family-model пишет в extended.family (не family_model)
  family_model: { schema: familyModelSchema, extendedKey: "family" },
  finance: { schema: financeSchema, extendedKey: "finance" },
  lifestyle: { schema: lifestyleSchema, extendedKey: "lifestyle" },
  health: { schema: healthSchema, extendedKey: "health" },
  // ручка анкеты appearance пишет в extended.langs (не appearance)
  appearance: { schema: appearanceSchema, extendedKey: "langs" },
  parents: { schema: parentsSchema, extendedKey: "parents" },
  birth_place: { schema: birthPlaceSchema, extendedKey: "birth_place" },
  marriage: { schema: marriageSchema, extendedKey: "marriage" },
  family: { schema: familyChildrenSchema, extendedKey: "family" },
  partner: { schema: partnerExtendedSchema, extendedKey: "partner" },
};

/**
 * Поля, которые надо ОБНУЛИТЬ, когда отпало их условие.
 *
 * Ровно та ловушка, что уже кусала в этом проекте с размером дохода: клиент
 * прячет вопрос и перестаёт слать поле, а сервер домержывает прежнее значение -
 * и в базе у человека, только что сказавшего «дохода нет», остаётся «10-20 млн».
 * Человек уверен, что отозвал ответ, а он на месте. Скрытое поле обязано
 * исчезать из ДАННЫХ, а не только с экрана.
 *
 * Возвращает имена полей (колонок или ключей extended), которые надо выставить
 * в null. Логика повторяет ручки анкеты тех же разделов.
 */
export function fieldsToClear(
  section: EditSectionKey,
  data: Record<string, unknown>,
): string[] {
  if (section === "finance") {
    // Берём ГОТОВУЮ функцию, а не переписываем условие своими значениями:
    // список вариантов, закрывающих вопрос о сумме, живёт в одном месте и
    // прикрыт тестом-стражем на случай переименования. Зашитая здесь копия
    // разошлась бы с ним ровно так же тихо, как разошлись ключи extended.
    return shouldAskIncomeRange(data.income_source_stability as string | null | undefined)
      ? []
      : ["monthly_income_range"];
  }
  if (section === "family") {
    const out: string[] = [];
    if (data.has_children !== "yes") out.push("children", "children_living");
    // Легаси-диапазон возраста заменён на children[].age - чистим всегда.
    out.push("children_age_range");
    // Сколько раз в браке спрашивают только у разведённых.
    if (data.marital_status !== "divorced") out.push("previous_marriages");
    return out;
  }
  return [];
}

/**
 * Имена полей, которые знает схема раздела.
 *
 * Нужны, чтобы в РЕДАКТОРЕ отсутствие поля означало «человек его стёр», а не
 * «не трогай». Разница принципиальная: анкета заполняется один раз и по частям,
 * поэтому там отсутствие ключа справедливо значит «пропусти». Правка же шлёт
 * раздел целиком - и если человек очистил необязательное поле, форма просто
 * перестаёт его слать. Проверено вживую: очистка «специальности» уходила в
 * пустоту, старое значение оставалось в базе, а человек видел «сохранено».
 */
export function knownFields(section: EditSectionKey): string[] {
  const sch = EDIT_SECTIONS[section].schema as unknown as {
    shape?: Record<string, unknown>;
    _def?: { schema?: { shape?: Record<string, unknown> } };
  };
  // Схемы с .refine оборачиваются в ZodEffects - настоящий объект лежит глубже.
  const shape = sch.shape ?? sch._def?.schema?.shape;
  return shape ? Object.keys(shape) : [];
}

export const EDIT_SECTION_KEYS = Object.keys(EDIT_SECTIONS) as EditSectionKey[];

export function isEditSection(v: unknown): v is EditSectionKey {
  return typeof v === "string" && (EDIT_SECTION_KEYS as string[]).includes(v);
}

export type SplitResult = {
  /** Что уходит в колонки user_profiles. */
  columns: Record<string, unknown>;
  /** Что уходит в extended[section]. */
  extended: Record<string, unknown>;
};

/**
 * Разложить проверенные данные раздела на колонки и JSON-блок.
 *
 * Поле с одноимённой колонкой едет в колонку, остальное - в extended. Поля из
 * NON_EDITABLE_COLUMNS выбрасываются молча и НИКОГДА не доезжают до базы, даже
 * если пришли в теле запроса: клиенту незачем уметь ставить себе status
 * 'published' или снимать флаг проверки семейного положения.
 */
export function splitSectionData(data: Record<string, unknown>): SplitResult {
  const columns: Record<string, unknown> = {};
  const extended: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (v === undefined) continue;
    if (NON_EDITABLE_COLUMNS.has(k)) continue;
    if (PROFILE_COLUMNS.has(k)) columns[k] = v;
    else extended[k] = v;
  }
  return { columns, extended };
}

/**
 * Разделы, правка которых влияет на подбор и требует побочных действий.
 *
 * `partner` меняет возрастные рамки - значит отказы «не подходит по возрасту»
 * теряют основание и должны сняться (иначе человек чинит фильтр, а лента
 * остаётся пустой). `family` меняет семейное положение - значит надо
 * пересчитать флаг проверки, ровно как это делает админская ручка правки
 * профиля: статусы «в разводе» и «женат, живём раздельно» выводят человека из
 * подбора до одобрения оператором.
 */
export const SECTION_CLEARS_AGE_SKIPS: EditSectionKey = "partner";
export const SECTION_RECHECKS_MARITAL: EditSectionKey = "family";
