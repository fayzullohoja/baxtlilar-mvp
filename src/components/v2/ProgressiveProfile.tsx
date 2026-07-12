/**
 * V2 ProgressiveProfile — анонимизированный вид кандидата ДО взаимного
 * интереса.
 *
 * Источник истины (продуктовое решение): см. memory
 * [[project-baxtlilar-v2-matching-model]] (2026-06-25).
 *
 * Что показываем (pre-mutual):
 *   ✓ Первое имя (только первое слово display_name — фамилия скрыта)
 *   ✓ Сфера занятости (общая категория, не конкретный работодатель)
 *   ✓ Уровень образования (общая категория)
 *   ✓ Город (нужен для встречи)
 *   ✓ Религия (для совместимости — пользователь сам решает)
 *   ✓ 1-3 черты личности из Big Five
 *   ✓ Текст bio (sanitized — анти-контакт фильтр уже на input)
 *
 * Что НЕ показываем (pre-mutual):
 *   ✗ Фотографии
 *   ✗ Возраст / дата рождения
 *   ✗ Фамилия (берём первое слово display_name)
 *   ✗ Конкретный работодатель / должность (их в БД и нет — есть только enum)
 *   ✗ Семейное положение / наличие детей (раскроется post-mutual)
 */

"use client";
import { useTranslations } from "next-intl";
import { Headline, Lead } from "./Headline";
import {
  EDUCATION,
  LIFE_VALUES_V3,
  labelOf,
} from "@/lib/profile/options";
import type { ProgressiveProfileView } from "@/lib/v2/progressive-view";

type Props = {
  profile: ProgressiveProfileView;
  /** Locale для labelOf — по умолчанию ru */
  locale?: string;
};

/**
 * Личностные черты из Big Five (O/C/E/A/ES) 0-100.
 * Возвращает 1-3 короткие фразы про доминирующие черты (>60) или их
 * противоположности (<40). Среднее (40-60) скипаем.
 */
function personalityTraits(vector: Record<string, number>): string[] {
  const out: string[] = [];
  const O = vector.O;
  const C = vector.C;
  const E = vector.E;
  const A = vector.A;
  const ES = vector.ES;

  if (typeof O === "number") {
    if (O > 60) out.push("открытый новому опыту");
    else if (O < 40) out.push("ценящий стабильность и привычное");
  }
  if (typeof C === "number") {
    if (C > 60) out.push("организованный и собранный");
    else if (C < 40) out.push("гибкий, без жёстких рамок");
  }
  if (typeof E === "number") {
    if (E > 60) out.push("заряжается от людей и общения");
    else if (E < 40) out.push("спокойный, предпочитает камерное");
  }
  if (typeof A === "number") {
    if (A > 60) out.push("тёплый и располагающий");
    else if (A < 40) out.push("прямой, без обиняков");
  }
  if (typeof ES === "number") {
    if (ES > 60) out.push("эмоционально устойчивый");
    else if (ES < 40) out.push("чувствительный, глубоко переживает");
  }

  // Если все черты в среднем диапазоне (40-60), секция «характер» пустовала бы.
  // Показываем ближайшую к краю черту, чтобы карточка не выглядела скромной.
  // (Если вектора ещё нет — напр. до прохождения опроса — вернём пусто.)
  if (out.length === 0) {
    const dims: Array<[number | undefined, string, string]> = [
      [O, "тянется к новому опыту", "ценит проверенное и привычное"],
      [C, "организованный и собранный", "гибкий, без жёстких рамок"],
      [E, "заряжается от общения", "спокойный, предпочитает камерное"],
      [A, "тёплый и располагающий", "прямой, без обиняков"],
      [ES, "эмоционально устойчивый", "тонко и глубоко чувствует"],
    ];
    let best: string | null = null;
    let bestDelta = -1;
    for (const [val, hi, lo] of dims) {
      if (typeof val !== "number") continue;
      const delta = Math.abs(val - 50);
      if (delta > bestDelta) {
        bestDelta = delta;
        best = val >= 50 ? hi : lo;
      }
    }
    if (best) return [best];
  }

  return out.slice(0, 3);
}

function chip(label: string, key: string | number, teal = false) {
  return (
    <span
      key={key}
      style={{
        display: "inline-block",
        padding: "7px 13px",
        marginRight: "6px",
        marginBottom: "6px",
        background: teal ? "var(--color-v2-chip-teal)" : "var(--color-v2-chip)",
        borderRadius: "999px",
        fontSize: "13px",
        fontWeight: 600,
        color: teal ? "var(--color-v2-chip-teal-ink)" : "var(--color-v2-chip-ink)",
        fontFamily: "var(--font-v2-body)",
      }}
    >
      {label}
    </span>
  );
}

/** Eyebrow-подзаголовок секции внутри hero-карточки. */
const sectionLabelStyle: React.CSSProperties = {
  fontSize: "12px",
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: "0.14em",
  color: "var(--color-v2-accent)",
  marginBottom: "10px",
  fontFamily: "var(--font-v2-body)",
};

export function ProgressiveProfile({ profile, locale = "ru" }: Props) {
  const t = useTranslations("Profile");
  const name = profile.first_name;
  const traits = personalityTraits(profile.vector);
  const values = profile.top_life_values.map((v: string) => ({
    key: v,
    label: labelOf(LIFE_VALUES_V3, v, locale),
  }));

  return (
    <article
      className="v2-rise"
      style={{
        background: "#ffffff",
        borderRadius: "var(--v2-radius-card)",
        boxShadow: "var(--v2-shadow-hero)",
        overflow: "hidden",
      }}
    >
      {/* Hero-шапка: гранатово-янтарный градиент, белое Piazzolla-имя */}
      <div
        style={{
          background: "var(--v2-grad-hero)",
          padding: "22px 20px 22px",
        }}
      >
        {/* Верхний ряд: монограмма-аватар (фото скрыто pre-mutual — заполняет
            «пустой» hero) слева + бейдж «Проверен» справа (только approved). */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "16px",
          }}
        >
          <div
            aria-hidden
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "999px",
              background: "rgba(255, 247, 240, 0.18)",
              border: "1.5px solid rgba(255, 247, 240, 0.45)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "var(--font-v2-display)",
              fontSize: "26px",
              fontWeight: 800,
              color: "#FFF7F0",
              flexShrink: 0,
            }}
          >
            {(name || "?").charAt(0).toUpperCase()}
          </div>

          {profile.is_verified ? (
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                background: "#ffffff",
                borderRadius: "999px",
                padding: "4px 11px 4px 5px",
                fontSize: "12px",
                fontWeight: 700,
                color: "var(--color-v2-ink-200)",
                fontFamily: "var(--font-v2-body)",
                boxShadow: "0 2px 8px rgba(42, 26, 46, 0.12)",
              }}
            >
              <span
                aria-hidden
                style={{
                  width: "15px",
                  height: "15px",
                  borderRadius: "999px",
                  background: "var(--color-v2-teal)",
                  color: "#ffffff",
                  fontSize: "9px",
                  lineHeight: "15px",
                  textAlign: "center",
                  flexShrink: 0,
                }}
              >
                ✓
              </span>
              {t("verifiedBadge")}
            </div>
          ) : null}
        </div>

        {/* Имя */}
        <Headline size="lg" as="h2" style={{ color: "#FFF7F0" }}>
          {name}
        </Headline>

        {/* Locality + spheres */}
        <div
          style={{
            marginTop: "10px",
            fontSize: "14px",
            fontWeight: 600,
            color: "rgba(255, 247, 240, 0.88)",
            fontFamily: "var(--font-v2-body)",
          }}
        >
          {profile.city ? <span>{profile.city}</span> : null}
          {profile.education && profile.education !== "na" ? (
            <span>
              {profile.city ? " · " : ""}
              {labelOf(EDUCATION, profile.education, locale)}
            </span>
          ) : null}
          {/* Вероисповедание НЕ показываем в публичной карточке (спец-категория ПД,
              ревью оунера 2026-07-10) — религия остаётся matching-only. Ценность
              «Вера» при этом видна через чипы top_life_values ниже. */}
        </div>
      </div>

      <div style={{ padding: "22px 20px 20px" }}>
        {/* Личностные черты */}
        {traits.length > 0 ? (
          <div>
            <div style={sectionLabelStyle}>{t('personalityLabel')}</div>
            <Lead style={{ marginTop: 0 }}>
              {name} —{" "}
              {traits.map((t, i) => (
                <span key={i}>
                  {t}
                  {i < traits.length - 1 ? "; " : "."}
                </span>
              ))}
            </Lead>
          </div>
        ) : null}

        {/* Что важно — values (вера → teal-чип) */}
        {values.length > 0 ? (
          <div style={{ marginTop: traits.length > 0 ? "24px" : 0 }}>
            <div style={sectionLabelStyle}>{t('valuesLabel')}</div>
            <div>{values.map((v, i) => chip(v.label, i, v.key === "faith"))}</div>
          </div>
        ) : null}

        {/* Bio — раскрывает голос */}
        {profile.bio ? (
          <div style={{ marginTop: "24px" }}>
            <div style={sectionLabelStyle}>{t('bioLabel')}</div>
            <p
              style={{
                fontFamily: "var(--font-v2-body)",
                fontSize: "16px",
                lineHeight: "1.55",
                color: "var(--color-v2-ink-200)",
                whiteSpace: "pre-wrap",
              }}
            >
              {profile.bio}
            </p>
          </div>
        ) : null}

        {/* Footnote про скрытое — teal-плашка приватности */}
        <div
          style={{
            marginTop: "26px",
            display: "flex",
            alignItems: "flex-start",
            gap: "8px",
            background: "var(--color-v2-chip-teal)",
            color: "var(--color-v2-chip-teal-ink)",
            borderRadius: "14px",
            padding: "12px 14px",
            fontSize: "12.5px",
            fontWeight: 600,
            fontFamily: "var(--font-v2-body)",
            lineHeight: "1.55",
          }}
        >
          <span aria-hidden style={{ flexShrink: 0 }}>🔒</span>
          <span>{t('privacyFooter')}</span>
        </div>
      </div>
    </article>
  );
}
