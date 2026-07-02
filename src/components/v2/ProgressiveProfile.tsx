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
  RELIGION,
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

  return out.slice(0, 3);
}

function chip(label: string, key: string | number) {
  return (
    <span
      key={key}
      style={{
        display: "inline-block",
        padding: "6px 12px",
        marginRight: "6px",
        marginBottom: "6px",
        background: "transparent",
        border: "1px solid var(--color-v2-ink-500)",
        borderRadius: "999px",
        fontSize: "13px",
        color: "var(--color-v2-ink-200)",
        fontFamily: "var(--font-v2-body)",
      }}
    >
      {label}
    </span>
  );
}

export function ProgressiveProfile({ profile, locale = "ru" }: Props) {
  const t = useTranslations("Profile");
  const name = profile.first_name;
  const traits = personalityTraits(profile.vector);
  const valueLabels = profile.top_life_values.map((v: string) =>
    labelOf(LIFE_VALUES_V3, v, locale),
  );

  return (
    <article style={{ padding: "8px 0" }}>
      {/* Имя */}
      <Headline size="lg" as="h2">
        {name}
      </Headline>

      {/* Locality + spheres */}
      <div
        style={{
          marginTop: "12px",
          fontSize: "14px",
          color: "var(--color-v2-ink-400)",
          fontFamily: "var(--font-v2-body)",
        }}
      >
        {profile.city ? <span>{profile.city}</span> : null}
        {profile.education && profile.education !== "na" ? (
          <span> · {labelOf(EDUCATION, profile.education, locale)}</span>
        ) : null}
        {profile.religion && profile.religion !== "na" ? (
          <span> · {labelOf(RELIGION, profile.religion, locale)}</span>
        ) : null}
      </div>

      {/* Личностные черты */}
      {traits.length > 0 ? (
        <div style={{ marginTop: "28px" }}>
          <div
            style={{
              fontSize: "11px",
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              color: "var(--color-v2-ink-400)",
              marginBottom: "10px",
            }}
          >
            {t('personalityLabel')}
          </div>
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

      {/* Что важно — values */}
      {valueLabels.length > 0 ? (
        <div style={{ marginTop: "28px" }}>
          <div
            style={{
              fontSize: "11px",
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              color: "var(--color-v2-ink-400)",
              marginBottom: "10px",
            }}
          >
            {t('valuesLabel')}
          </div>
          <div>{valueLabels.map((l: string, i: number) => chip(l, i))}</div>
        </div>
      ) : null}

      {/* Bio — раскрывает голос */}
      {profile.bio ? (
        <div style={{ marginTop: "28px" }}>
          <div
            style={{
              fontSize: "11px",
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              color: "var(--color-v2-ink-400)",
              marginBottom: "10px",
            }}
          >
            {t('bioLabel')}
          </div>
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

      {/* Footnote про скрытое */}
      <div
        style={{
          marginTop: "32px",
          paddingTop: "16px",
          borderTop: "1px solid var(--color-v2-ink-500)",
          fontSize: "12px",
          color: "var(--color-v2-ink-400)",
          fontFamily: "var(--font-v2-body)",
          lineHeight: "1.55",
        }}
      >
        {t('privacyFooter')}
      </div>
    </article>
  );
}
