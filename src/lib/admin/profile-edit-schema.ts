// Реестр редактируемых полей анкеты для админ-редактора (карточка клиента →
// ProfileTab). Декларативные метаданные: label / тип / опции / hot-cold по
// секциям. Один источник истины для UI (рендер инпутов) И роута (валидация +
// маршрутизация hot-колонка vs extended.<section>).
//
// ПРИНЦИПЫ:
// - Whitelist: поля НЕ из реестра роут отвергает → защита от mass-assignment.
//   Паспортные `gender` / `birth_date` СПЕЦИАЛЬНО отсутствуют (авторитетны из
//   верифицированного паспорта, правятся ре-верификацией). Также нет
//   `looking_for_gender` (авто-выводится из пола) и `children[]` (сложный
//   вложенный массив) — v1.
// - hot vs cold задаётся ЯВНО через `cold` (splitHotCold/HOT_COLUMNS неполон —
//   не полагаемся на него). Нет `cold` → прямая колонка user_profiles;
//   `cold: "finance"` → extended.finance.<key>.

import type { Opt } from "@/lib/profile/options";
import {
  CITIZENSHIP,
  COUNTRY_OF_RESIDENCE,
  UZ_REGIONS,
  MARITAL_STATUS,
  HAS_CHILDREN,
  FUTURE_CHILDREN_PLAN,
  RELIGION,
  RELIGION_PRACTICE,
  MARRIAGE_READINESS,
  RELOCATION_READINESS,
  PROFILE_VISIBILITY_MODE,
  EDUCATION,
  ACTIVITY_FIELDS,
  EMPLOYMENT_FORMAT,
  EMPLOYMENT_STATUS,
  LANGUAGES_LIST,
  LIFE_VALUES_V3,
  FAMILY_ROLE_MODEL,
  WIFE_WORK_VIEW,
  POST_MARRIAGE_LIVING,
  FAMILY_DECISION_MODEL,
  HOUSEHOLD_RESPONSIBILITY_MODEL,
  SEPARATE_FROM_PARENTS_IMPORTANCE,
  INCOME_SOURCE_STABILITY,
  FAMILY_FINANCE_MANAGEMENT,
  MONTHLY_INCOME_RANGE,
  FINANCIAL_OBLIGATIONS,
  HOUSING_STATUS,
  FINANCIAL_PRIORITIES,
  LIFESTYLE_PACE,
  DAILY_ROUTINE,
  BAD_HABITS_LEVEL,
  NUTRITION_STYLE,
  ALCOHOL_LEVEL,
  DRUGS_USE,
  FREE_TIME_ACTIVITIES,
  PARTNER_QUALITIES,
  RELIGION_PARTNER_MATCH,
  PARTNER_PREFERRED_COUNTRIES,
  GEO_PREFERENCE,
} from "@/lib/profile/options";

export type EditKind = "text" | "textarea" | "number" | "select" | "multiselect" | "toggle";

export type EditField = {
  key: string;
  label: string;
  kind: EditKind;
  options?: readonly Opt[]; // select / multiselect
  cold?: string; // extended-секция; отсутствует → прямая колонка user_profiles
  min?: number; // number
  max?: number; // number
  maxLen?: number; // text / textarea
  maxItems?: number; // multiselect
  required?: boolean; // NOT NULL колонка — очистка в null запрещена
  hint?: string;
};

// partner_religion_match: DB CHECK допускает только 3 значения из 5 в options.ts
// (drift — close_values/not_decisive не в CHECK → иначе 500). Ограничиваем
// редактор валидным подмножеством. (Онбординг-дрифт по этому полю — отдельно.)
const RELIGION_PARTNER_MATCH_VALID = RELIGION_PARTNER_MATCH.filter((o) =>
  ["same_religion", "same_religion_same_practice", "mutual_respect"].includes(o.value),
);

export type EditSection = { title: string; sensitive?: boolean; fields: EditField[] };

export const PROFILE_EDIT_SECTIONS: readonly EditSection[] = [
  {
    title: "Основное",
    fields: [
      { key: "display_name", label: "Имя (ник)", kind: "text", maxLen: 50 },
      { key: "citizenship", label: "Гражданство", kind: "select", options: CITIZENSHIP },
      { key: "country_of_residence", label: "Страна проживания", kind: "select", options: COUNTRY_OF_RESIDENCE },
      { key: "region", label: "Регион", kind: "select", options: UZ_REGIONS },
      { key: "district", label: "Район (код)", kind: "text", maxLen: 128, hint: "код района" },
      { key: "district_visible_public", label: "Район публично", kind: "toggle" },
      { key: "marital_status", label: "Семейный статус", kind: "select", options: MARITAL_STATUS },
      { key: "has_children", label: "Дети", kind: "select", options: HAS_CHILDREN },
      { key: "children_count", label: "Кол-во детей", kind: "number", min: 0, max: 10 },
      { key: "future_children_plan", label: "Планы на детей", kind: "select", options: FUTURE_CHILDREN_PLAN },
      { key: "religion", label: "Религия", kind: "select", options: RELIGION },
      { key: "religion_practice", label: "Практика веры", kind: "select", options: RELIGION_PRACTICE },
      { key: "marriage_readiness", label: "Готовность к браку", kind: "select", options: MARRIAGE_READINESS },
      { key: "relocation_readiness", label: "Готовность к переезду", kind: "select", options: RELOCATION_READINESS },
      { key: "profile_visibility_mode", label: "Видимость профиля", kind: "select", options: PROFILE_VISIBILITY_MODE, required: true },
    ],
  },
  {
    title: "Образование и работа",
    fields: [
      { key: "education", label: "Образование", kind: "select", options: EDUCATION },
      { key: "activity_field", label: "Сфера деятельности", kind: "select", options: ACTIVITY_FIELDS },
      { key: "employment_format", label: "Формат занятости", kind: "select", options: EMPLOYMENT_FORMAT },
      { key: "employment_status", label: "Статус занятости", kind: "select", options: EMPLOYMENT_STATUS },
    ],
  },
  {
    title: "Внешность",
    fields: [
      { key: "height_cm", label: "Рост, см", kind: "number", min: 140, max: 220 },
      { key: "weight_kg", label: "Вес, кг", kind: "number", min: 40, max: 200 },
      { key: "native_language", label: "Родной язык", kind: "select", options: LANGUAGES_LIST },
      { key: "languages", label: "Языки", kind: "multiselect", options: LANGUAGES_LIST, maxItems: 6 },
    ],
  },
  {
    title: "Место рождения",
    fields: [
      { key: "birth_country", label: "Страна", kind: "select", options: COUNTRY_OF_RESIDENCE },
      { key: "birth_region", label: "Регион", kind: "select", options: UZ_REGIONS },
      { key: "birth_district", label: "Район (код)", kind: "text", maxLen: 128 },
      { key: "birth_city", label: "Город (код)", kind: "text", maxLen: 128 },
    ],
  },
  {
    title: "Ценности",
    fields: [
      { key: "top_life_values", label: "Жизненные ценности", kind: "multiselect", options: LIFE_VALUES_V3, maxItems: 3 },
    ],
  },
  {
    title: "Семейная модель",
    fields: [
      { key: "family_role_model", label: "Модель семьи", kind: "select", options: FAMILY_ROLE_MODEL },
      { key: "wife_work_after_marriage_view", label: "Работа жены после брака", kind: "select", options: WIFE_WORK_VIEW },
      { key: "post_marriage_living", label: "Проживание после брака", kind: "select", options: POST_MARRIAGE_LIVING },
      { key: "decision_model", label: "Принятие решений", kind: "select", options: FAMILY_DECISION_MODEL, cold: "family" },
      { key: "household_responsibility_model", label: "Быт / обязанности", kind: "select", options: HOUSEHOLD_RESPONSIBILITY_MODEL, cold: "family" },
      { key: "separate_from_parents_importance", label: "Жить отдельно от родителей", kind: "select", options: SEPARATE_FROM_PARENTS_IMPORTANCE, cold: "living" },
    ],
  },
  {
    title: "Финансы",
    sensitive: true,
    fields: [
      { key: "income_source_stability", label: "Стабильность дохода", kind: "select", options: INCOME_SOURCE_STABILITY, cold: "finance" },
      { key: "financial_stability_importance", label: "Важность фин. стабильности (1–5)", kind: "number", min: 1, max: 5, cold: "finance" },
      { key: "family_finance_management", label: "Управление бюджетом", kind: "select", options: FAMILY_FINANCE_MANAGEMENT, cold: "finance" },
      { key: "monthly_income_range", label: "Диапазон дохода", kind: "select", options: MONTHLY_INCOME_RANGE, cold: "finance" },
      { key: "financial_obligations", label: "Фин. обязательства", kind: "select", options: FINANCIAL_OBLIGATIONS, cold: "finance" },
      { key: "housing_status", label: "Жильё", kind: "select", options: HOUSING_STATUS, cold: "finance" },
      { key: "financial_priorities", label: "Фин. приоритеты", kind: "multiselect", options: FINANCIAL_PRIORITIES, maxItems: 3, cold: "finance" },
    ],
  },
  {
    title: "Образ жизни",
    sensitive: true,
    fields: [
      { key: "lifestyle_pace", label: "Темп жизни", kind: "select", options: LIFESTYLE_PACE, cold: "lifestyle" },
      { key: "daily_routine", label: "Распорядок дня", kind: "select", options: DAILY_ROUTINE, cold: "lifestyle" },
      { key: "bad_habits_level", label: "Вредные привычки", kind: "select", options: BAD_HABITS_LEVEL, cold: "lifestyle" },
      { key: "nutrition_style", label: "Питание", kind: "select", options: NUTRITION_STYLE, cold: "lifestyle" },
      { key: "alcohol_level", label: "Алкоголь", kind: "select", options: ALCOHOL_LEVEL, cold: "lifestyle" },
      { key: "drugs_use", label: "Наркотики", kind: "select", options: DRUGS_USE, cold: "lifestyle" },
      { key: "free_time_activities", label: "Досуг", kind: "multiselect", options: FREE_TIME_ACTIVITIES, maxItems: 3, cold: "lifestyle" },
    ],
  },
  {
    title: "Кого ищет",
    fields: [
      { key: "partner_age_min", label: "Возраст партнёра, от", kind: "number", min: 18, max: 99 },
      { key: "partner_age_max", label: "Возраст партнёра, до", kind: "number", min: 18, max: 99 },
      { key: "partner_height_min", label: "Рост партнёра, от", kind: "number", min: 140, max: 220 },
      { key: "partner_height_max", label: "Рост партнёра, до", kind: "number", min: 140, max: 220 },
      { key: "partner_religion_match", label: "Религия партнёра", kind: "select", options: RELIGION_PARTNER_MATCH_VALID },
      { key: "geo_preference", label: "География (legacy)", kind: "select", options: GEO_PREFERENCE },
      { key: "partner_top_qualities", label: "Качества партнёра", kind: "multiselect", options: PARTNER_QUALITIES, maxItems: 5 },
      { key: "partner_preferred_countries", label: "Страны партнёра", kind: "multiselect", options: PARTNER_PREFERRED_COUNTRIES, maxItems: 3 },
    ],
  },
  {
    title: "Дополнительно",
    fields: [
      { key: "bio", label: "О себе (bio)", kind: "textarea", maxLen: 1000 },
      { key: "hobbies", label: "Хобби", kind: "textarea", maxLen: 500, cold: "bio" },
      { key: "about_family", label: "О семье", kind: "textarea", maxLen: 500, cold: "bio" },
    ],
  },
];

/** Плоская мапа key → EditField (для валидации в роуте). ВНИМАНИЕ: ключи cold-
 *  и hot-полей уникальны в текущем реестре; если появится коллизия имён между
 *  секциями — переключить на составной ключ. */
export const EDIT_FIELD_BY_KEY: Record<string, EditField> = Object.fromEntries(
  PROFILE_EDIT_SECTIONS.flatMap((s) => s.fields).map((f) => [f.key, f]),
);
