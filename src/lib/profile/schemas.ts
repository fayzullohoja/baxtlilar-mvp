import { z } from "zod";
import {
  vals,
  GENDER,
  MARITAL_STATUS,
  HAS_CHILDREN,
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
} from "./options";
import { ALL_CITY_VALUES } from "./cities";

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
const MESSENGER_RE =
  /(?<![\p{L}\d])(telegram|телеграм|телега|тг|instagram|инстаграм|инста|whats?app|вотсап|ватсап|воцап|viber|вайбер|signal|сигнал|discord|wickr|session|skype|скайп|messenger|мессенджер)(?![\p{L}\d])/u;

export function containsContact(text: string): boolean {
  // нормализация: NFKC (полноширинные цифры → ascii) + удалить ТОЛЬКО zero-width вставки.
  // Обычные пробелы НЕ убираем — иначе легитимные диапазоны ловятся.
  const norm = text.normalize("NFKC").replace(/[​-‏﻿]/g, "");
  const low = norm.toLowerCase();
  return PHONE_RE.test(norm) || HANDLE_RE.test(norm) || LINK_RE.test(norm) || MESSENGER_RE.test(low);
}

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
    // Refine ниже валидирует это правило.
    region: z.string().trim().max(80).optional(),
    city: z.enum(tuple(ALL_CITY_VALUES)),
    bio: z
      .string()
      .trim()
      .min(20, { message: "bio_too_short" })
      .max(1000, { message: "bio_too_long" })
      .refine((s) => !containsContact(s), { message: "bio_has_contacts" }),
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
  height_cm: z.coerce.number().int().min(140).max(220),
  // Вес — soft optional поле (anti drop-off, особенно для женщин).
  weight_kg: z.coerce.number().int().min(35).max(200).optional().nullable(),
  native_language: z.enum(tuple(vals(LANGUAGES_LIST))),
  // languages[] (что владеет) — min 1 (должен включать native обычно).
  languages: z.array(z.enum(tuple(vals(LANGUAGES_LIST)))).min(1).max(6),
});

export const familySchema = z.object({
  marital_status: z.enum(tuple(vals(MARITAL_STATUS))),
  has_children: z.enum(tuple(vals(HAS_CHILDREN))),
  children_plan: z.enum(tuple(vals(CHILDREN_PLAN))),
});

/** V2 ext 2026-06-28: убран religion_importance 1-5 (создавал ложное "вера
 *  может быть неважна" для UZ-платформы). Заменён на religion_practice
 *  (качественная градация образа жизни) + опциональный religion_partner_match
 *  (требование к партнёру, не к себе). */
export const valuesSchema = z.object({
  religion: z.enum(tuple(vals(RELIGION))),
  religion_practice: z.enum(tuple(vals(RELIGION_PRACTICE))),
  religion_partner_match: z.enum(tuple(vals(RELIGION_PARTNER_MATCH))).optional(),
  values: z.array(z.enum(tuple(vals(LIFE_VALUES)))).min(1).max(3),
  education: z.enum(tuple(vals(EDUCATION))),
  employment: z.enum(tuple(vals(EMPLOYMENT))).optional(),
});

/** V2 ext 2026-06-28: формат проживания после брака — ключевой матчинг-сигнал
 *  для serious-marriage платформы. Required. */
export const marriageSchema = z.object({
  post_marriage_living: z.enum(tuple(vals(POST_MARRIAGE_LIVING))),
});

// Пол партнёра НЕ спрашиваем — выводится автоматически как противоположный своему (см. looking-for route).
export const lookingForSchema = z
  .object({
    partner_age_min: z.coerce.number().int().min(18).max(100),
    partner_age_max: z.coerce.number().int().min(18).max(100),
    geo_preference: z.enum(tuple(vals(GEO_PREFERENCE))),
  })
  .refine((d) => d.partner_age_max >= d.partner_age_min, { message: "age_range_invalid" });
