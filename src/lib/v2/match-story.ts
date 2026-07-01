/**
 * V3 Match Story — генератор пояснений почему алгоритм подобрал именно
 * этого человека.
 *
 * Не показывает "score: 87". Показывает осмысленный текст:
 *   - 2-3 причины почему мы думаем что вы совпадаете
 *   - 1-2 нюанса на которые стоит обратить внимание (caution)
 *   - 1 совет: о чём поговорить, когда откроется чат
 *
 * Источник истины (продуктовое решение): см. memory
 * [[project-baxtlilar-v2-matching-model]] — учредитель 2026-06-25.
 *
 * V3 Sprint 3 cleanup (2026-06-29):
 * - `religion_importance` (1-5 шкала) → `religion_practice` (4 enum опции).
 *   Шкала убрана из анкеты как создающая ложное "вера может быть неважна".
 *   Логика "близость по практике" работает на качественной градации.
 * - `children_plan` → `future_children_plan` (5 новых опций).
 * - `values` → `top_life_values` (14 опций V3 вместо 9 V2).
 *
 * Принцип: рекомендация, не навязывание. Тон вежливо-уверенный, никаких
 * "идеальное совпадение!" или процентов.
 */

import { LIFE_VALUES_V3, labelOf } from "@/lib/profile/options";
import { ageFromDate } from "@/lib/profile/schemas";

export type ProfileForMatch = {
  display_name: string;
  city: string | null;
  top_life_values: string[];
  birth_date: string | null;
  marital_status: string | null;
  has_children: string | null;
  future_children_plan: string | null;
  religion: string | null;
  religion_practice: string | null;
  education: string | null;
  bio: string | null;
  partner_age_min: number | null;
  partner_age_max: number | null;
  geo_preference: string | null;
  vector: Record<string, number>;
};

export type MatchStory = {
  reasons: string[];
  cautions: string[];
  advice: string | null;
};

// =============================================================================
// Reasons (positive overlap)
// =============================================================================

function sharedValues(viewer: ProfileForMatch, cand: ProfileForMatch): string[] {
  return viewer.top_life_values.filter((v) => cand.top_life_values.includes(v));
}

function vectorAvgDiff(a: Record<string, number>, b: Record<string, number>): number | null {
  const FACTORS = ["O", "C", "E", "A", "ES"];
  const diffs = FACTORS.map((f) => {
    const x = a[f];
    const y = b[f];
    return typeof x === "number" && typeof y === "number" ? Math.abs(x - y) : null;
  }).filter((x): x is number => x !== null);
  if (!diffs.length) return null;
  return diffs.reduce((s, d) => s + d, 0) / diffs.length;
}

function ageInRange(age: number, min: number | null, max: number | null): boolean {
  if (min === null || max === null) return false;
  return age >= min && age <= max;
}

/** Качественная градация religion_practice — преобразуем в порядковое число
 *  для сравнения близости. Чем выше число, тем сильнее практика. */
function practiceLevel(p: string | null): number | null {
  if (!p) return null;
  switch (p) {
    case "observant":
      return 4;
    case "striving":
      return 3;
    case "cultural":
      return 2;
    case "not_practicing":
      return 1;
    default:
      return null;
  }
}

function reasonsFor(viewer: ProfileForMatch, cand: ProfileForMatch): string[] {
  const out: string[] = [];

  const shared = sharedValues(viewer, cand);
  if (shared.length >= 2) {
    const labels = shared.slice(0, 3).map((v) => labelOf(LIFE_VALUES_V3, v, "ru"));
    out.push(`У Вас совпадают ключевые ценности — ${labels.join(", ").toLowerCase()}.`);
  } else if (shared.length === 1) {
    const lab = labelOf(LIFE_VALUES_V3, shared[0], "ru");
    out.push(`Вас обоих волнует одно — ${lab.toLowerCase()}.`);
  }

  // Религия + близость практики
  if (
    viewer.religion &&
    cand.religion &&
    viewer.religion === cand.religion &&
    viewer.religion !== "na" &&
    viewer.religion !== "none"
  ) {
    const vLvl = practiceLevel(viewer.religion_practice);
    const cLvl = practiceLevel(cand.religion_practice);
    const gap = vLvl !== null && cLvl !== null ? Math.abs(vLvl - cLvl) : null;
    if (gap === null || gap <= 1) {
      out.push("Совпали по вероисповеданию и тому, насколько оно живёт в повседневности.");
    }
  }

  // Семейные планы совместимы
  if (viewer.future_children_plan && cand.future_children_plan) {
    const PRO_KIDS = new Set(["yes_soon", "yes_later", "maybe"]);
    const NO_KIDS = new Set(["no"]);
    const bothPro =
      PRO_KIDS.has(viewer.future_children_plan) && PRO_KIDS.has(cand.future_children_plan);
    const bothNo =
      NO_KIDS.has(viewer.future_children_plan) && NO_KIDS.has(cand.future_children_plan);
    if (bothPro) out.push("Оба видите будущее с детьми.");
    else if (bothNo) out.push("Оба не планируете детей в будущем — это редкое совпадение.");
  }

  // Близость психо-вектора (если есть quiz_results у обоих)
  const diff = vectorAvgDiff(viewer.vector, cand.vector);
  if (diff !== null && diff < 18) {
    out.push("Похожая личностная структура — Вам будет легко друг друга понимать.");
  }

  // Совпадение города (если оба указали)
  if (viewer.city && cand.city && viewer.city === cand.city && out.length < 3) {
    out.push("Один город — встретиться будет несложно.");
  }

  return out.slice(0, 3);
}

// =============================================================================
// Cautions (friction)
// =============================================================================

function cautionsFor(viewer: ProfileForMatch, cand: ProfileForMatch): string[] {
  const out: string[] = [];

  // Конфликт по детям
  if (viewer.future_children_plan && cand.future_children_plan) {
    const PRO_KIDS = new Set(["yes_soon", "yes_later"]);
    const NO_KIDS = new Set(["no"]);
    const conflict =
      (PRO_KIDS.has(viewer.future_children_plan) &&
        NO_KIDS.has(cand.future_children_plan)) ||
      (NO_KIDS.has(viewer.future_children_plan) &&
        PRO_KIDS.has(cand.future_children_plan));
    if (conflict) {
      out.push("По-разному смотрите на детей в будущем. Это важно обсудить сразу.");
    }
  }

  // Большой разрыв в религиозной практике (≥2 уровня)
  const vLvl = practiceLevel(viewer.religion_practice);
  const cLvl = practiceLevel(cand.religion_practice);
  if (vLvl !== null && cLvl !== null && Math.abs(vLvl - cLvl) >= 2) {
    out.push("Религия живёт в Ваших жизнях по-разному.");
  }

  // Гео несовпадение + оба хотят свой город
  if (
    viewer.city &&
    cand.city &&
    viewer.city !== cand.city &&
    viewer.geo_preference === "my_city" &&
    cand.geo_preference === "my_city"
  ) {
    out.push("Вы в разных городах, и оба предпочитаете не уезжать.");
  }

  // Возраст вне взаимных диапазонов
  if (viewer.birth_date && cand.birth_date) {
    const viewerAge = ageFromDate(viewer.birth_date);
    const candAge = ageFromDate(cand.birth_date);
    const viewerInCandRange = ageInRange(viewerAge, cand.partner_age_min, cand.partner_age_max);
    const candInViewerRange = ageInRange(candAge, viewer.partner_age_min, viewer.partner_age_max);
    if (!viewerInCandRange || !candInViewerRange) {
      out.push("Возраст слегка вне диапазона который Вы оба указывали как желаемый.");
    }
  }

  return out.slice(0, 2);
}

// =============================================================================
// Advice (conversation starter)
// =============================================================================

const ADVICE_BY_VALUE: Record<string, string> = {
  family: "Расспросите про традиции, которые он(а) хотел(а) бы перенести в свою семью.",
  faith: "Узнайте как вера живёт в повседневности — не только в праздники.",
  honesty: "Спросите про момент, когда честность стоила ему(ей) чего-то дорогого.",
  respect: "Узнайте, какое отношение он(а) сам(а) считает уважительным.",
  kindness: "Спросите когда последний раз чья-то доброта запомнилась.",
  responsibility: "Какие обязательства держат сейчас в фокусе.",
  tradition: "Какие семейные обычаи особенно ценные.",
  education: "Что сейчас изучает или чему хотел(а) бы научиться.",
  health: "Какой ритм жизни считает здоровым — сон, движение, паузы.",
  career: "Что в работе сейчас даёт энергию, а что забирает.",
  financial_stability: "Как смотрит на совместный бюджет — раздельно, общий, гибридно.",
  community: "Расскажите про свою махаллю / соседей — что любите там.",
  self_development: "Чему учится или планирует научиться в этом году.",
  independence: "Что значит «своё пространство» в отношениях.",
};

function adviceFor(viewer: ProfileForMatch, cand: ProfileForMatch): string | null {
  const shared = sharedValues(viewer, cand);
  if (!shared.length) return null;
  return ADVICE_BY_VALUE[shared[0]] ?? null;
}

// =============================================================================
// Public API
// =============================================================================

export function generateMatchStory(
  viewer: ProfileForMatch,
  cand: ProfileForMatch,
): MatchStory {
  return {
    reasons: reasonsFor(viewer, cand),
    cautions: cautionsFor(viewer, cand),
    advice: adviceFor(viewer, cand),
  };
}
