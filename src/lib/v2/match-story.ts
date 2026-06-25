/**
 * V2 Match Story — генератор пояснений почему алгоритм подобрал именно
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
 * Принцип: рекомендация, не навязывание. Тон вежливо-уверенный, никаких
 * "идеальное совпадение!" или процентов.
 */

import { LIFE_VALUES, labelOf } from "@/lib/profile/options";
import { ageFromDate } from "@/lib/profile/schemas";

export type ProfileForMatch = {
  display_name: string;
  city: string | null;
  values: string[];
  birth_date: string | null;
  marital_status: string | null;
  has_children: string | null;
  children_plan: string | null;
  religion: string | null;
  religion_importance: number | null;
  education: string | null;
  employment: string | null;
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
  return viewer.values.filter((v) => cand.values.includes(v));
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

function reasonsFor(viewer: ProfileForMatch, cand: ProfileForMatch): string[] {
  const out: string[] = [];

  const shared = sharedValues(viewer, cand);
  if (shared.length >= 2) {
    const labels = shared.slice(0, 3).map((v) => labelOf(LIFE_VALUES, v, "ru"));
    out.push(`У вас совпадают ключевые ценности — ${labels.join(", ").toLowerCase()}.`);
  } else if (shared.length === 1) {
    const lab = labelOf(LIFE_VALUES, shared[0], "ru");
    out.push(`Вас обоих волнует одно — ${lab.toLowerCase()}.`);
  }

  // Религия + важность близки
  if (
    viewer.religion &&
    cand.religion &&
    viewer.religion === cand.religion &&
    viewer.religion !== "na"
  ) {
    const impGap =
      viewer.religion_importance !== null && cand.religion_importance !== null
        ? Math.abs(viewer.religion_importance - cand.religion_importance)
        : null;
    if (impGap === null || impGap <= 1) {
      out.push("Совпали по вероисповеданию и тому, насколько оно важно в жизни.");
    }
  }

  // Семейные планы совместимы
  if (viewer.children_plan && cand.children_plan) {
    const PRO_KIDS = new Set(["want", "have_maybe_more", "open"]);
    const NO_KIDS = new Set(["have_no_more"]);
    const bothPro = PRO_KIDS.has(viewer.children_plan) && PRO_KIDS.has(cand.children_plan);
    const bothNo = NO_KIDS.has(viewer.children_plan) && NO_KIDS.has(cand.children_plan);
    if (bothPro) out.push("Оба видите будущее с детьми.");
    else if (bothNo) out.push("Оба не планируете детей в будущем — это редкое совпадение.");
  }

  // Близость психо-вектора (если есть quiz_results у обоих)
  const diff = vectorAvgDiff(viewer.vector, cand.vector);
  if (diff !== null && diff < 18) {
    out.push("Похожая личностная структура — вам будет легко друг друга понимать.");
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
  if (viewer.children_plan && cand.children_plan) {
    const PRO_KIDS = new Set(["want", "have_maybe_more"]);
    const NO_KIDS = new Set(["have_no_more"]);
    const conflict =
      (PRO_KIDS.has(viewer.children_plan) && NO_KIDS.has(cand.children_plan)) ||
      (NO_KIDS.has(viewer.children_plan) && PRO_KIDS.has(cand.children_plan));
    if (conflict) {
      out.push("По-разному смотрите на детей в будущем. Это важно обсудить сразу.");
    }
  }

  // Большой разрыв в важности религии
  if (viewer.religion_importance !== null && cand.religion_importance !== null) {
    if (Math.abs(viewer.religion_importance - cand.religion_importance) >= 3) {
      out.push("Религия играет в ваших жизнях очень разную роль.");
    }
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
      out.push("Возраст слегка вне диапазона который вы оба указывали как желаемый.");
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
  growth: "Что сейчас изучает или чему хотел(а) бы научиться в ближайший год?",
  health: "Какой ритм жизни считает здоровым — сон, движение, паузы.",
  career: "Что в работе сейчас даёт энергию, а что забирает.",
  finance: "Как смотрит на совместный бюджет — раздельно, общий, гибридно.",
  helping: "Кому помогает регулярно и почему именно им.",
  freedom: "Что значит «своё пространство» в отношениях.",
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
