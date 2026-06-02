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

/** Признаки контактов/ссылок/рекламы в «о себе» / сообщениях. */
export function containsContact(text: string): boolean {
  // нормализация: NFKC (полноширинные цифры → ascii) + удалить ТОЛЬКО zero-width вставки.
  // Обычные пробелы НЕ убираем — иначе диапазоны «2018-2022» / «3 000 000 - 5 000 000» ложно ловятся.
  const norm = text.normalize("NFKC").replace(/[​-‍﻿]/g, "");
  const low = norm.toLowerCase();
  // телефон: ≥9 «цифр с одиночным разделителем» подряд (узб. номер = 9 цифр). Год (4 цифры) и
  // диапазоны через « - » не дают 9 в одном прогоне → не блокируются.
  return (
    /(\+?\d[ .()-]?){9,}/.test(norm) || // телефон
    /@[A-Za-z0-9_]{3,}/.test(norm) || // @username
    /(https?:\/\/|www\.|\bt\.me\b|\b\S+\.(?:uz|ru|com|net|org|me)\b)/i.test(norm) || // ссылки
    /\b(telegram|телеграм|instagram|инстаграм|whats?app|вотсап|ватсап|viber|вайбер)\b/.test(low) // мессенджеры
  );
}

export const basicSchema = z.object({
  display_name: z.string().trim().min(2).max(50),
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
