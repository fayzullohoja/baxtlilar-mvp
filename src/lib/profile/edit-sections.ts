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

export const EDIT_SECTIONS: Record<EditSectionKey, SectionDef> = {
  self: { schema: selfSchema, extendedKey: "self" },
  values: { schema: valuesV3Schema, extendedKey: "values" },
  family_model: { schema: familyModelSchema, extendedKey: "family_model" },
  finance: { schema: financeSchema, extendedKey: "finance" },
  lifestyle: { schema: lifestyleSchema, extendedKey: "lifestyle" },
  health: { schema: healthSchema, extendedKey: "health" },
  appearance: { schema: appearanceSchema, extendedKey: "appearance" },
  parents: { schema: parentsSchema, extendedKey: "parents" },
  birth_place: { schema: birthPlaceSchema, extendedKey: "birth_place" },
  marriage: { schema: marriageSchema, extendedKey: "marriage" },
  family: { schema: familyChildrenSchema, extendedKey: "family" },
  partner: { schema: partnerExtendedSchema, extendedKey: "partner" },
};

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
