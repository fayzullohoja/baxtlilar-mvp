import { z } from "zod";
import {
  vals,
  GENDER,
  MARITAL_STATUS,
  HAS_CHILDREN,
  CHILDREN_LIVING,
  CHILDREN_AGE_RANGE,
  CHILDREN_PLAN,
  RELIGION,
  LIFE_VALUES,
  EDUCATION,
  EMPLOYMENT,
  GEO_PREFERENCE,
  // V2 ext 2026-06-28:
  CITIZENSHIP,
  COUNTRY_OF_RESIDENCE,
  UZ_REGIONS,
  LANGUAGES_LIST,
  RELIGION_PRACTICE,
  RELIGION_PARTNER_MATCH,
  POST_MARRIAGE_LIVING,
  // V3 MVP 2026-06-29:
  ACTIVITY_FIELDS,
  EMPLOYMENT_FORMAT,
  EMPLOYMENT_STATUS,
  FUTURE_CHILDREN_PLAN,
  LIFE_VALUES_V3,
  FAMILY_ROLE_MODEL,
  WIFE_WORK_VIEW,
  FAMILY_DECISION_MODEL,
  HOUSEHOLD_RESPONSIBILITY_MODEL,
  SEPARATE_FROM_PARENTS_IMPORTANCE,
  PARTNER_QUALITIES,
  PROFILE_VISIBILITY_MODE,
  // V4 2026-06-30 — Чат 2 — Анкета:
  INCOME_SOURCE_STABILITY,
  FAMILY_FINANCE_MANAGEMENT,
  FINANCIAL_PRIORITIES,
  MONTHLY_INCOME_RANGE,
  FINANCIAL_OBLIGATIONS,
  LIFESTYLE_PACE,
  FREE_TIME_ACTIVITIES,
  DAILY_ROUTINE,
  BAD_HABITS_LEVEL,
  NUTRITION_STYLE,
  ALCOHOL_LEVEL,
  DRUGS_USE,
  PARTNER_PREFERRED_COUNTRIES,
  // V5 owner spec 2026-07-07:
  MARRIAGE_READINESS,
  RELOCATION_READINESS,
  HOUSING_STATUS,
  // Ревью оунера 2026-07-10 Экран 12:
  PARTNER_MARITAL_PREF,
  PARTNER_CHILDREN_PREF,
  PARTNER_ORIGIN_REGION_PREF,
  PARTNER_HARD_CRITERIA,
} from "./options";

const tuple = (a: string[]) => a as [string, ...string[]];

/** Возраст в полных годах на сегодня. */
export function ageFromDate(dateStr: string): number {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return -1;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
}

// F-009 v2: расширенный анти-контакт фильтр.
//   - Underscore (_) в классе разделителей телефона → ловит "9_0_1_2_3..."
//   - До 2 подряд разделителей между цифрами → ловит "9  0  1 ..." (двойной пробел),
//     при этом "3 000 000 - 5 000 000" (диапазон через ' - ', 3 char) НЕ ловится.
//   - @-handle принимает Cyrillic → ловит "@саша_2024" (homoglyph-обход)
//   - Расширенный TLD-список → ловит wa.link, linktr.ee, bit.ly, t.co, signal.app и т.п.
//   - Расширенный словарь мессенджеров (RU/UZ-сленг): телега, тг, инста,
//     signal, discord, wickr, session.
const PHONE_RE = /(\+?\d[ .()_\-]{0,2}){9,}/;
const HANDLE_RE = /@[A-Za-zЀ-ӿ0-9_]{3,}/;
const TLD_GROUP =
  "uz|ru|com|net|org|me|app|io|xyz|tg|ly|ee|cc|co|am|gg|info|biz|link|net|app|tk|pw|cn|us";
const LINK_RE = new RegExp(
  `(https?:\\/\\/|www\\.|\\bt\\.me\\b|\\b\\S+\\.(?:${TLD_GROUP})\\b)`,
  "i",
);
// JS-`\b` смотрит только на ASCII-word-char — для кириллических 'тг'/'телега'
// он не срабатывает (пробел↔кириллица не считается границей слова). Поэтому
// явные lookaround'ы через Unicode-категорию буквы/цифры.
// SU-1: русские склоняются — ловим падежные формы. Однозначным мессенджер-
// корням разрешаем суффикс до 3 кир. букв (вотсапе/вайбера/дискорде/инстаграме).
// Короткие корни со сменой финальной гласной (инста→инсту/инсте, телега→телегу)
// задаём точным набором гласных, чтобы НЕ ловить инстинкт/инстанцию/телеграф.
// Неоднозначные слова (signal/сигнал/session/skype-eng) — оставляем точными.
const MESSENGER_STEMS = [
  "telegram", "instagram", "whats?app", "viber", "signal",
  "discord", "wickr", "session", "skype", "messenger",
  "телеграм[а-яё]{0,3}", "инстаграм[а-яё]{0,3}",
  "вотсап[а-яё]{0,3}", "ватсап[а-яё]{0,3}", "воцап[а-яё]{0,3}", "вацап[а-яё]{0,3}",
  "вайбер[а-яё]{0,3}", "дискорд[а-яё]{0,3}", "скайп[а-яё]{0,3}", "мессенджер[а-яё]{0,3}",
  "телег[ауеи]", "инст[ауеы]",
  "сигнал", "тг",
];
const MESSENGER_RE = new RegExp(
  `(?<![\\p{L}\\d])(?:${MESSENGER_STEMS.join("|")})(?![\\p{L}\\d])`,
  "u",
);

export function containsContact(text: string): boolean {
  // нормализация: NFKC (полноширинные цифры → ascii) + удалить ТОЛЬКО zero-width вставки.
  // Обычные пробелы НЕ убираем — иначе легитимные диапазоны ловятся.
  const norm = text.normalize("NFKC").replace(/[​-‏﻿]/g, "");
  const low = norm.toLowerCase();
  return PHONE_RE.test(norm) || HANDLE_RE.test(norm) || LINK_RE.test(norm) || MESSENGER_RE.test(low);
}

/** V3 Sprint 3 round 2: упрощённый basic.
 *  Убраны city (отдельный город дублировал region) и bio (теперь только на
 *  Экране 3 Self). Учредительская поправка после тест-прохода 2026-06-29.
 */
export const basicSchema = z
  .object({
    // F-009 v2: display_name тоже фильтруется на контакты — раньше нарушители
    // прятали "@ali_2024" или номер в имя профиля, и оно появлялось в ленте/чате
    // в обход bio/chat-фильтра.
    display_name: z
      .string()
      .trim()
      .min(2)
      .max(50)
      .refine((s) => !containsContact(s), { message: "name_has_contacts" }),
    gender: z.enum(tuple(vals(GENDER))),
    birth_date: z
      .string()
      .refine((s) => ageFromDate(s) >= 18, { message: "must_be_18" })
      .refine((s) => ageFromDate(s) <= 100, { message: "invalid_age" }),
    // V2 ext 2026-06-28: гражданство и страна проживания (могут не совпадать —
    // например гражданин UZ живущий в РФ). При approve паспорта в админке
    // citizenship сверяется с user_identity (mismatch → flag модератору).
    citizenship: z.enum(tuple(vals(CITIZENSHIP))),
    country_of_residence: z.enum(tuple(vals(COUNTRY_OF_RESIDENCE))),
    // region — обязателен только для UZ (для других стран — пустая строка/опц).
    region: z.string().trim().max(80).optional(),
    // V4 2026-06-30 (Чат 2 — Анкета, Экран 2): район проживания. Для UZ —
    // выбирается из UZ_DISTRICTS_BY_REGION (cascading select по выбранному
    // региону), для не-UZ — оставлен опциональным (часть страны не покрыта).
    district: z.string().trim().max(128).optional().nullable(),
    // V4: чекбокс «показывать ли район в анкете публично». По умолчанию false —
    // район виден после взаимного интереса (приватность учредителя:
    // «минимум инфо до match»). Используется в ProgressiveProfile.
    district_visible_public: z.boolean().optional(),
  })
  .refine(
    (d) => {
      // Для UZ-проживания region обязателен и должен быть из UZ_REGIONS.
      if (d.country_of_residence !== "UZ") return true;
      if (!d.region) return false;
      return vals(UZ_REGIONS).includes(d.region);
    },
    { message: "region_required_for_uz", path: ["region"] },
  );

/** V2 ext 2026-06-28: демография — рост/вес/языки. */
export const appearanceSchema = z.object({
  // Ревью оунера Экран 2: рост опционален (range-picker), не required.
  height_cm: z.coerce.number().int().min(140).max(220).optional().nullable(),
  // Вес — soft optional поле (anti drop-off, особенно для женщин).
  weight_kg: z.coerce.number().int().min(35).max(200).optional().nullable(),
  native_language: z.enum(tuple(vals(LANGUAGES_LIST))),
  // languages[] (что владеет) — min 1 (должен включать native обычно).
  languages: z.array(z.enum(tuple(vals(LANGUAGES_LIST)))).min(1).max(6),
  // Ревью оунера Экран 2: свободный ввод при выборе «Другой/Boshqa». COLD → extended.langs.
  other_language: z.string().trim().max(60).optional().nullable(),
});

export const familySchema = z.object({
  marital_status: z.enum(tuple(vals(MARITAL_STATUS))),
  has_children: z.enum(tuple(vals(HAS_CHILDREN))),
  children_plan: z.enum(tuple(vals(CHILDREN_PLAN))),
});

/** V2 ext 2026-06-28: убран religion_importance 1-5 (создавал ложное "вера
 *  может быть неважна" для UZ-платформы). Заменён на religion_practice
 *  (качественная градация образа жизни) + опциональный religion_partner_match
 *  (требование к партнёру, не к себе).
 *  V4 2026-06-30: religion_practice стал .optional() — учредитель счёл
 *  follow-up «как Вы с этим живёте» лишним. UI form-поле удалено; столбец
 *  оставлен в БД до миграции legacy данных. religion_partner_match переезжает
 *  в partner-extended (раздел «Кого ищу»). */
export const valuesSchema = z.object({
  religion: z.enum(tuple(vals(RELIGION))),
  religion_practice: z.enum(tuple(vals(RELIGION_PRACTICE))).optional(),
  religion_partner_match: z.enum(tuple(vals(RELIGION_PARTNER_MATCH))).optional(),
  values: z.array(z.enum(tuple(vals(LIFE_VALUES)))).min(1).max(3),
  education: z.enum(tuple(vals(EDUCATION))),
  employment: z.enum(tuple(vals(EMPLOYMENT))).optional(),
});

/** V2 ext 2026-06-28: формат проживания после брака — ключевой матчинг-сигнал
 *  для serious-marriage платформы. Required. */
export const marriageSchema = z.object({
  post_marriage_living: z.enum(tuple(vals(POST_MARRIAGE_LIVING))),
  // V5 owner spec §12/§13: секция «Жизнь после брака». Optional (anti-drop-off,
  // мягкие матчинг-сигналы). marriage_readiness — темп; relocation_readiness —
  // готовность переехать (≠ geo_preference «где искать»).
  marriage_readiness: z.enum(tuple(vals(MARRIAGE_READINESS))).optional(),
  relocation_readiness: z.enum(tuple(vals(RELOCATION_READINESS))).optional(),
});

// Пол партнёра НЕ спрашиваем — выводится автоматически как противоположный своему (см. looking-for route).
export const lookingForSchema = z
  .object({
    partner_age_min: z.coerce.number().int().min(18).max(100),
    partner_age_max: z.coerce.number().int().min(18).max(100),
    geo_preference: z.enum(tuple(vals(GEO_PREFERENCE))),
  })
  .refine((d) => d.partner_age_max >= d.partner_age_min, { message: "age_range_invalid" });

// ============================================================================
// Anketa V3 MVP (2026-06-29) — Sprint 1
// ============================================================================

/** Экран 2 — Место рождения. */
export const birthPlaceSchema = z
  .object({
    birth_country: z.string().trim().min(2).max(64),
    birth_region: z.string().trim().max(128).optional().nullable(),
    birth_district: z.string().trim().max(128).optional().nullable(),
    birth_city: z.string().trim().max(128).optional().nullable(),
  })
  // Ревью оунера Экран 6: для UZ регион обязателен (Select из UZ_REGIONS).
  // Клиент прячет freeform и показывает Select — сервер обязан проверить то же.
  .refine((d) => d.birth_country !== "UZ" || !!d.birth_region?.trim(), {
    message: "birth_region_required_for_uz",
    path: ["birth_region"],
  })
  // Для UZ регион обязан быть каноническим кодом из UZ_REGIONS — иначе freeform-строка
  // (из другой страны) может утечь в hot-колонку birth_region и сломать гео/землячество.
  .refine(
    (d) =>
      d.birth_country !== "UZ" ||
      !d.birth_region?.trim() ||
      vals(UZ_REGIONS).includes(d.birth_region.trim()),
    { message: "birth_region_invalid_for_uz", path: ["birth_region"] },
  );

/** Экран 3 — О себе + образование + деятельность + формат занятости. */
export const selfSchema = z.object({
  bio: z
    .string()
    .trim()
    .min(30, { message: "bio_too_short" })
    .max(1000, { message: "bio_too_long" })
    .refine((s) => !containsContact(s), { message: "bio_has_contacts" }),
  education: z.enum(tuple(vals(EDUCATION))),
  // Ревью оунера Экран 4: условное поле «специальность / направление» (показывается
  // при высшем/среднем-спец/магистр/PhD/учусь). COLD → extended.self. Опциональное.
  specialty: z.string().trim().max(80).optional().nullable(),
  activity_field: z.enum(tuple(vals(ACTIVITY_FIELDS))),
  // Ревью оунера Экран 4: свободный ввод при выборе «Другое» в сфере. COLD → extended.self.
  activity_field_other: z.string().trim().max(80).optional().nullable(),
  // Ревью оунера Экран 4: статус занятости — primary (required); формат работы —
  // условный/опциональный (показывается при working/entrepreneur/freelancer).
  employment_status: z.enum(tuple(vals(EMPLOYMENT_STATUS))),
  employment_format: z.enum(tuple(vals(EMPLOYMENT_FORMAT))).optional().nullable(),
});

/** Экран 5 — Семья и дети (расширение familySchema). */
export const familyChildrenSchema = z
  .object({
    marital_status: z.enum(tuple(vals(MARITAL_STATUS))),
    has_children: z.enum(tuple(vals(HAS_CHILDREN))),
    // Ревью оунера Экран 5: количество детей — бакеты 1/2/3/4+/«не уточнять»;
    // форма шлёт int (4+→4, «не уточнять»→null). Колонка hot int (0-10).
    children_count: z.coerce.number().int().min(0).max(10).optional().nullable(),
    // Возраст детей — диапазоны (не точный возраст), COLD → extended.family.
    children_age_range: z.enum(tuple(vals(CHILDREN_AGE_RANGE))).optional().nullable(),
    // С кем проживают дети (COLD → extended.family, опц.).
    children_living: z.enum(tuple(vals(CHILDREN_LIVING))).optional().nullable(),
    future_children_plan: z.enum(tuple(vals(FUTURE_CHILDREN_PLAN))),
  });
// Ревью оунера Экран 5: жёсткий refine убран. У количества детей появился вариант
// «Предпочитаю не уточнять» (→ null валидно даже при has_children=yes), возраст —
// необязательный диапазон. UI требует выбор количества (в т.ч. «не уточнять»),
// сервер не форсит наличие числа/возраста.

/** Экран 6 — Ценности и вера (новая версия с top_life_values вместо values).
 *  V4 2026-06-30 (Чат-2): religion_practice стал optional и удалён из формы;
 *  religion_partner_match переезжает в partner-extended (раздел «Кого ищу»). */
export const valuesV3Schema = z.object({
  religion: z.enum(tuple(vals(RELIGION))),
  religion_practice: z.enum(tuple(vals(RELIGION_PRACTICE))).optional(),
  religion_partner_match: z.enum(tuple(vals(RELIGION_PARTNER_MATCH))).optional(),
  top_life_values: z.array(z.enum(tuple(vals(LIFE_VALUES_V3)))).min(1).max(3),
});

/** Экран 7 — Семейная модель. Hot колонки (family_role_model, wife_work) +
 *  cold детали (decision_model, household_responsibility) пойдут в extended. */
export const familyModelSchema = z.object({
  family_role_model: z.enum(tuple(vals(FAMILY_ROLE_MODEL))),
  wife_work_after_marriage_view: z.enum(tuple(vals(WIFE_WORK_VIEW))),
  family_decision_model: z.enum(tuple(vals(FAMILY_DECISION_MODEL))).optional(),
  household_responsibility_model: z.enum(tuple(vals(HOUSEHOLD_RESPONSIBILITY_MODEL))).optional(),
});

/** Экран 8 — Ожидания от партнёра (расширение lookingForSchema).
 *  V4 2026-06-30: добавлены partner_religion_match (переехал из values),
 *  partner_preferred_countries (max 3, soft filter — НЕ excluder). */
export const partnerExtendedSchema = z
  .object({
    partner_age_min: z.coerce.number().int().min(18).max(100),
    partner_age_max: z.coerce.number().int().min(18).max(100),
    partner_height_min: z.coerce.number().int().min(140).max(220).optional().nullable(),
    partner_height_max: z.coerce.number().int().min(140).max(220).optional().nullable(),
    partner_top_qualities: z.array(z.enum(tuple(vals(PARTNER_QUALITIES)))).min(1).max(5),
    // V4 — религия партнёра. Это требование к партнёру, не к себе. Корректно
    // живёт в «Кого ищу», а не в «О себе».
    partner_religion_match: z.enum(tuple(vals(RELIGION_PARTNER_MATCH))).optional(),
    // V4 — список приоритетных стран партнёра. Soft filter (matching weight),
    // НЕ жёсткий отсев — учредитель явно сказал «не делать жёстким фильтром».
    // Источник опций — существующий CITIZENSHIP (8 значений). Max 3.
    partner_preferred_countries: z
      .array(z.enum(tuple(vals(PARTNER_PREFERRED_COUNTRIES))))
      .max(3)
      .optional(),
    // Ревью оунера Экран 12 — доп. ожидания. COLD → extended.partner (endpoint пишет вручную).
    partner_marital_pref: z.array(z.enum(tuple(vals(PARTNER_MARITAL_PREF)))).max(5).optional(),
    partner_children_pref: z.enum(tuple(vals(PARTNER_CHILDREN_PREF))).optional(),
    partner_origin_region_pref: z.enum(tuple(vals(PARTNER_ORIGIN_REGION_PREF))).optional(),
    // hard/soft-переключатель: какие критерии принципиальны (не обсуждаются). COLD,
    // информационное (не энфорсится в matching). Пусто = все гибкие.
    partner_hard_criteria: z.array(z.enum(tuple(vals(PARTNER_HARD_CRITERIA)))).max(6).optional(),
  })
  .refine((d) => d.partner_age_max >= d.partner_age_min, { message: "age_range_invalid" })
  .refine(
    (d) =>
      d.partner_height_min == null ||
      d.partner_height_max == null ||
      d.partner_height_max >= d.partner_height_min,
    { message: "height_range_invalid" },
  );

// ============================================================================
// V4 NEW STEPS (2026-06-30) — Чат 2 — Анкета.md Экраны 9, 10
// ============================================================================

/** V4 Экран 9 — Финансы и материальная стабильность. Hidden public.
 *  6 блоков по спеке: income source, importance (1-5), management,
 *  priorities (≤3), income range (UZS), obligations.
 *  По умолчанию весь экран приватен; видимость регулируется per-block flags
 *  в extended.privacy либо глобально profile_visibility_mode. */
export const financeSchema = z.object({
  income_source_stability: z.enum(tuple(vals(INCOME_SOURCE_STABILITY))),
  financial_stability_importance: z.coerce.number().int().min(1).max(5),
  family_finance_management: z.enum(tuple(vals(FAMILY_FINANCE_MANAGEMENT))),
  financial_priorities: z.array(z.enum(tuple(vals(FINANCIAL_PRIORITIES)))).min(1).max(3),
  monthly_income_range: z.enum(tuple(vals(MONTHLY_INCOME_RANGE))).optional(),
  financial_obligations: z.enum(tuple(vals(FINANCIAL_OBLIGATIONS))).optional(),
  // V5 owner spec §9: жильё. Optional, cold (extended.finance), hidden public.
  housing_status: z.enum(tuple(vals(HOUSING_STATUS))).optional(),
});

/** V4 Экран 10 — Образ жизни и привычки. Hidden public.
 *  7 блоков по спеке: pace, free-time (≤3), routine, bad habits, nutrition,
 *  alcohol, drugs. Привычки/алкоголь/наркотики — sensitive, скрываются до
 *  взаимного интереса даже после публикации профиля. */
export const lifestyleSchema = z.object({
  lifestyle_pace: z.enum(tuple(vals(LIFESTYLE_PACE))),
  free_time_activities: z.array(z.enum(tuple(vals(FREE_TIME_ACTIVITIES)))).min(1).max(3),
  daily_routine: z.enum(tuple(vals(DAILY_ROUTINE))),
  bad_habits_level: z.enum(tuple(vals(BAD_HABITS_LEVEL))).optional(),
  nutrition_style: z.enum(tuple(vals(NUTRITION_STYLE))).optional(),
  alcohol_level: z.enum(tuple(vals(ALCOHOL_LEVEL))).optional(),
  drugs_use: z.enum(tuple(vals(DRUGS_USE))).optional(),
});

/** Экран 12 — Будущая семья и формат проживания (расширение marriageSchema). */
export const futureFamilySchema = z.object({
  post_marriage_living: z.enum(tuple(vals(POST_MARRIAGE_LIVING))),
  separate_from_parents_importance: z
    .enum(tuple(vals(SEPARATE_FROM_PARENTS_IMPORTANCE)))
    .optional(),
});

/** Экран 16 — Глобальная видимость профиля. Per-block visibility — НЕ в MVP. */
export const privacySchema = z.object({
  profile_visibility_mode: z.enum(tuple(vals(PROFILE_VISIBILITY_MODE))),
});

// ============================================================================
// extended jsonb — sparse-bucket для cold-полей V3
// ============================================================================

export const EXTENDED_SCHEMA_VERSION = 1;

/** Структура extended jsonb. Cold/sparse поля живут здесь. */
export const extendedSchema = z
  .object({
    _meta: z
      .object({
        schema_version: z.number().int().positive(),
        completed_at: z.string().datetime().optional(),
      })
      .optional(),
    children: z
      .object({
        age_ranges: z.array(z.number().int().min(0).max(50)).optional(),
        future_plan_details: z
          .object({
            timing: z.string().max(50).optional(),
            count_preference: z.number().int().min(0).max(10).optional(),
            conditions: z.string().max(500).optional(),
          })
          .optional(),
      })
      .optional(),
    family: z
      .object({
        views: z.array(z.string().max(50)).max(5).optional(),
        decision_model: z.enum(tuple(vals(FAMILY_DECISION_MODEL))).optional(),
        household_responsibility_model: z
          .enum(tuple(vals(HOUSEHOLD_RESPONSIBILITY_MODEL)))
          .optional(),
      })
      .optional(),
    living: z
      .object({
        future_format: z.string().max(50).optional(),
        separate_from_parents_importance: z
          .enum(tuple(vals(SEPARATE_FROM_PARENTS_IMPORTANCE)))
          .optional(),
      })
      .optional(),
    partner: z
      .object({
        location_preference: z
          .object({
            scope: z.enum(["same_city", "same_region", "same_country", "any"]),
            cities: z.array(z.string().max(80)).max(10).optional(),
          })
          .optional(),
      })
      .optional(),
    bio: z
      .object({
        hobbies: z.string().max(500).optional(),
        about_family: z.string().max(500).optional(),
      })
      .optional(),
    privacy: z
      .object({
        // Зарезервировано для Sprint 2-3 (per-block visibility) — в Sprint 1 не пишется.
        per_block: z
          .record(z.string(), z.enum(["public", "match_only", "hidden"]))
          .optional(),
      })
      .optional(),
    // V4 2026-06-30 — Финансы и материальная стабильность (Чат-2 Экран 9).
    // Cold секция: финансы не показываются публично — только после взаимного
    // интереса. Все поля optional; форма требует свои внутри своей валидации.
    finance: z
      .object({
        income_source_stability: z.string().max(40).optional(),
        financial_stability_importance: z.number().int().min(1).max(5).optional(),
        family_finance_management: z.string().max(40).optional(),
        financial_priorities: z.array(z.string().max(40)).max(3).optional(),
        monthly_income_range: z.string().max(40).optional(),
        financial_obligations: z.string().max(40).optional(),
      })
      .optional(),
    // V4 2026-06-30 — Образ жизни и привычки (Чат-2 Экран 10). Cold секция.
    // Sensitive поля (bad_habits/alcohol/drugs) скрываются до mutual_interest.
    lifestyle: z
      .object({
        lifestyle_pace: z.string().max(40).optional(),
        free_time_activities: z.array(z.string().max(40)).max(3).optional(),
        daily_routine: z.string().max(40).optional(),
        bad_habits_level: z.string().max(40).optional(),
        nutrition_style: z.string().max(40).optional(),
        alcohol_level: z.string().max(40).optional(),
        drugs_use: z.string().max(40).optional(),
      })
      .optional(),
  })
  .strict();

export type ExtendedProfile = z.infer<typeof extendedSchema>;

/** Validate extended jsonb payload. Throws if invalid. */
export function validateExtended(input: unknown): ExtendedProfile {
  return extendedSchema.parse(input);
}

// ============================================================================
// Hot/cold split helper
// ============================================================================

/** Список hot-колонок которые пишутся напрямую в user_profiles. Всё остальное
 *  идёт в extended jsonb. Держать в синхроне с миграцией 20260629000000. */
export const HOT_COLUMNS = new Set([
  // OB-1 (2026-07-02): identity-поля basic — РЕАЛЬНЫЕ колонки user_profiles.
  // Их отсутствие здесь заставляло splitHotCold класть их в cold → basic-роут
  // писал их в extended jsonb, а колонки оставались NULL → publish навсегда
  // profile_incomplete, gender-wording ломался. Держать в синхроне со схемой.
  "display_name",
  "gender",
  "birth_date",
  "citizenship",
  "country_of_residence",
  "region",
  "birth_country",
  "birth_region",
  "birth_district",
  "birth_city",
  "activity_field",
  "employment_format",
  "employment_status",
  "marriage_readiness",
  "relocation_readiness",
  "children_count",
  "youngest_child_age",
  "future_children_plan",
  "top_life_values",
  "family_role_model",
  "wife_work_after_marriage_view",
  "partner_height_min",
  "partner_height_max",
  "partner_top_qualities",
  "profile_visibility_mode",
  // V4 2026-06-30 — Чат 2 — Анкета.md:
  // district хранится hot (часто читается ProgressiveProfile и matching по гео).
  "district",
  "district_visible_public",
  // partner_extended — hot для matching:
  "partner_religion_match",
  "partner_preferred_countries",
]);

/** Разделяет payload на hot (колонки user_profiles) и cold (extended jsonb). */
export function splitHotCold(payload: Record<string, unknown>): {
  hot: Record<string, unknown>;
  cold: Record<string, unknown>;
} {
  const hot: Record<string, unknown> = {};
  const cold: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(payload)) {
    if (HOT_COLUMNS.has(k)) hot[k] = v;
    else cold[k] = v;
  }
  return { hot, cold };
}
