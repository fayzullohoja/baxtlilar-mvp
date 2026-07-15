/**
 * APP-1 (2026-07-02) — узкая проекция профиля для pre-mutual клиентского вида.
 *
 * ProgressiveProfile — "use client" компонент; всё, что ему передаётся, попадает
 * в сериализованный RSC-payload и доступно любому, кто откроет карточку (bulk-
 * scrape). Раньше страница передавала полный ProfileForMatch с birth_date (точная
 * дата рождения!), marital_status, has_children, future_children_plan,
 * partner_age_*, geo_preference и полным display_name (фамилия) — хотя компонент
 * их НЕ рендерит. Это утечка чувствительных ПД до взаимного интереса.
 *
 * toProgressiveView оставляет РОВНО то, что рендерится pre-mutual (см.
 * [[project-baxtlilar-v2-matching-model]]): первое имя (без фамилии), город,
 * образование, ценности, bio (sanitized), Big Five vector. Всё остальное
 * раскрывается post-mutual через RevealedProfile.
 *
 * Религия: по ревью оунера 2026-07-10 стала matching-only (спец-категория ПД) и
 * pre-mutual НЕ показывается (ProgressiveProfile её не рендерит). Поэтому religion
 * УБРАНА из pre-mutual view type — иначе она сериализовалась бы в RSC/Flight-payload
 * клиента (видна в Network) и противоречила бы privacy-обещанию «вероисповедание скрыто».
 */
import { ageFromDate } from "@/lib/profile/schemas";

export type ProgressiveProfileView = {
  first_name: string;
  city: string | null;
  education: string | null;
  top_life_values: string[];
  bio: string | null;
  vector: Record<string, number>;
  // Спек 1.18/1.20 (решение оунера 2026-07-16): портрет + ВОЗРАСТ (лет, НЕ точная
  // дата) видны в pre-mutual карточке. Точная дата рождения по-прежнему скрыта.
  age: number | null;
  photo_url: string | null;
  // Ревью оунера: бейдж «Проверен» показываем ТОЛЬКО для approved-профилей.
  // verification_status не ПД (уже гейтит выдачу на сервере) → безопасно в pre-mutual.
  is_verified: boolean;
};

/** Только поля, реально нужные для pre-mutual-вида. Чувствительные поля
 *  (birth_date, marital_status, has_children, partner_age_*, geo_preference,
 *  religion) сюда НЕ входят — страница их не передаёт, значит они не могут утечь. */
export type ProgressiveViewInput = {
  display_name: string | null;
  city: string | null;
  education: string | null;
  top_life_values: string[] | null;
  bio: string | null;
  vector: Record<string, number>;
  // Опционально: если loader не передал — is_verified=false (бейдж не покажем).
  verification_status?: string | null;
  // Спек 1.20: точную дату НЕ отдаём клиенту — конвертируем в возраст (лет) здесь.
  // photo_url — уже подписанный (short-TTL) URL ТОЛЬКО портрета (не full_body/family).
  birth_date?: string | null;
  photo_url?: string | null;
};

/** Первое слово — фамилия скрыта pre-mutual. */
function firstWord(s: string): string {
  return s.trim().split(/\s+/)[0] ?? s;
}

/** Возраст в годах или null (пустая/невалидная дата → null, не -1). */
function computeAge(birthDate: string | null | undefined): number | null {
  if (!birthDate) return null;
  const a = ageFromDate(birthDate);
  return a > 0 ? a : null;
}

export function toProgressiveView(p: ProgressiveViewInput): ProgressiveProfileView {
  return {
    first_name: firstWord(p.display_name ?? ""),
    city: p.city ?? null,
    education: p.education ?? null,
    top_life_values: p.top_life_values ?? [],
    bio: p.bio ?? null,
    vector: p.vector ?? {},
    is_verified: p.verification_status === "approved",
    // birth_date НЕ попадает в output — только производный возраст (лет). ageFromDate
    // на непарсируемой дате вернёт -1 → отдаём null (не рендерим «-1»).
    age: computeAge(p.birth_date),
    photo_url: p.photo_url ?? null,
  };
}
