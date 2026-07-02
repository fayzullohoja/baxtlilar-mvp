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
 * [[project-baxtlilar-v2-matching-model]] + решение учредителя 2026-06-25):
 * первое имя (без фамилии), город, образование, религия (founder: видима),
 * ценности, bio (sanitized), Big Five vector. Всё остальное раскрывается
 * post-mutual через RevealedProfile.
 */
export type ProgressiveProfileView = {
  first_name: string;
  city: string | null;
  education: string | null;
  religion: string | null;
  top_life_values: string[];
  bio: string | null;
  vector: Record<string, number>;
};

/** Только поля, реально нужные для pre-mutual-вида. Чувствительные поля
 *  (birth_date, marital_status, has_children, partner_age_*, geo_preference)
 *  сюда НЕ входят — страница их не передаёт, значит они не могут утечь. */
export type ProgressiveViewInput = {
  display_name: string | null;
  city: string | null;
  education: string | null;
  religion: string | null;
  top_life_values: string[] | null;
  bio: string | null;
  vector: Record<string, number>;
};

/** Первое слово — фамилия скрыта pre-mutual. */
function firstWord(s: string): string {
  return s.trim().split(/\s+/)[0] ?? s;
}

export function toProgressiveView(p: ProgressiveViewInput): ProgressiveProfileView {
  return {
    first_name: firstWord(p.display_name ?? ""),
    city: p.city ?? null,
    education: p.education ?? null,
    religion: p.religion ?? null,
    top_life_values: p.top_life_values ?? [],
    bio: p.bio ?? null,
    vector: p.vector ?? {},
  };
}
