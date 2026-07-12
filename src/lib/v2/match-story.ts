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
 * - `children_plan` → `future_children_plan` (5 новых опций).
 * - `values` → `top_life_values` (14 опций V3 вместо 9 V2).
 *
 * V4 (2026-06-30): learning_practice убран из анкеты по учредительской
 * поправке №5 («как Вы с этим живёте» — лишний follow-up). Matching теперь
 * работает только на religion type equality (одна ли конфессия), без учёта
 * уровня практики — сигнал стал грубее, но семантически чище.
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

  // 2026-07-12 (privacy fix, owner A4): вероисповедание и планы на детей —
  // post-mutual поля (спец-ПД; progressive-view их НЕ отдаёт на клиент).
  // Раньше здесь были reasons «Совпали по вероисповеданию» и «Оба видите
  // будущее с детьми» — они раскрывали значение кандидата ДО взаимного
  // интереса (зритель знает своё → пиннит чужое). Убрано: до мэтча story
  // строится только на whitelist-полях (ценности, психо-вектор, город).

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

function cautionsFor(
  viewer: ProfileForMatch,
  cand: ProfileForMatch,
  relaxLevel: number,
): string[] {
  const out: string[] = [];

  // MATCH-3 — honest note: если кандидат показан с relax-уровня, говорим об
  // этом прямо (в начале — slice(0,2) не должен его вытеснить). Generic-caution
  // про возраст ниже при этом не добавляем — это был бы дубль той же мысли.
  if (relaxLevel > 0) {
    out.push(
      "Мы немного расширили возрастной диапазон поиска, чтобы показать Вам этого человека.",
    );
  }

  // 2026-07-12 (privacy fix, owner A4): убраны cautions по планам на детей
  // (future_children_plan) и по гео-предпочтению (geo_preference) — оба поля
  // post-mutual (progressive-view их не отдаёт), а caution раскрывал значение
  // кандидата до мэтча. До взаимного интереса caution строится только на
  // relax-факте и возрастных диапазонах (не спец-ПД).

  // Возраст вне взаимных диапазонов
  if (relaxLevel === 0 && viewer.birth_date && cand.birth_date) {
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
  relaxLevel = 0,
): MatchStory {
  return {
    reasons: reasonsFor(viewer, cand),
    cautions: cautionsFor(viewer, cand, relaxLevel),
    advice: adviceFor(viewer, cand),
  };
}
