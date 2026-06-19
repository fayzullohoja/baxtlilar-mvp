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

export const basicSchema = z.object({
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
  city: z.enum(tuple(ALL_CITY_VALUES)),
  bio: z
    .string()
    .trim()
    .min(20, { message: "bio_too_short" })
    .max(1000, { message: "bio_too_long" })
    .refine((s) => !containsContact(s), { message: "bio_has_contacts" }),
});

export const familySchema = z.object({
  marital_status: z.enum(tuple(vals(MARITAL_STATUS))),
  has_children: z.enum(tuple(vals(HAS_CHILDREN))),
  children_plan: z.enum(tuple(vals(CHILDREN_PLAN))),
});

export const valuesSchema = z.object({
  religion: z.enum(tuple(vals(RELIGION))),
  religion_importance: z.coerce.number().int().min(1).max(5),
  values: z.array(z.enum(tuple(vals(LIFE_VALUES)))).min(1).max(3),
  education: z.enum(tuple(vals(EDUCATION))),
  employment: z.enum(tuple(vals(EMPLOYMENT))).optional(),
});

// Пол партнёра НЕ спрашиваем — выводится автоматически как противоположный своему (см. looking-for route).
export const lookingForSchema = z
  .object({
    partner_age_min: z.coerce.number().int().min(18).max(100),
    partner_age_max: z.coerce.number().int().min(18).max(100),
    geo_preference: z.enum(tuple(vals(GEO_PREFERENCE))),
  })
  .refine((d) => d.partner_age_max >= d.partner_age_min, { message: "age_range_invalid" });
