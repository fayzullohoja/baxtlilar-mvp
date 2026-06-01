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

/** Признаки контактов/ссылок/рекламы в «о себе». */
export function containsContact(text: string): boolean {
  return (
    /\+?\d[\d\s().-]{6,}\d/.test(text) || // телефон
    /@[A-Za-z0-9_]{3,}/.test(text) || // @username
    /(https?:\/\/|www\.|\bt\.me\b|\b\S+\.(?:uz|ru|com|net|org)\b)/i.test(text) // ссылки
  );
}

export const basicSchema = z.object({
  display_name: z.string().trim().min(2).max(50),
  gender: z.enum(tuple(vals(GENDER))),
  birth_date: z
    .string()
    .refine((s) => ageFromDate(s) >= 18, { message: "must_be_18" })
    .refine((s) => ageFromDate(s) <= 100, { message: "invalid_age" }),
  city: z.string().trim().min(2).max(80),
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

export const lookingForSchema = z
  .object({
    looking_for_gender: z.enum(tuple(vals(GENDER))),
    partner_age_min: z.coerce.number().int().min(18).max(100),
    partner_age_max: z.coerce.number().int().min(18).max(100),
    geo_preference: z.enum(tuple(vals(GEO_PREFERENCE))),
  })
  .refine((d) => d.partner_age_max >= d.partner_age_min, { message: "age_range_invalid" });
