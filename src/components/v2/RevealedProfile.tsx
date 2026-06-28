/**
 * V2 RevealedProfile — post-mutual вид кандидата.
 *
 * Открывается когда mutual interest (есть чат между viewer и target).
 * Показываем ВСЁ:
 *   ✓ Полное имя как написал в анкете
 *   ✓ Все фото (carousel)
 *   ✓ Возраст
 *   ✓ Все детали из ProgressiveProfile + employment/marital/children
 *
 * Источник: Blueprint §3.4 C3.
 */

import { Headline, Lead } from "./Headline";
import {
  EDUCATION,
  RELIGION,
  MARITAL_STATUS,
  HAS_CHILDREN,
  FUTURE_CHILDREN_PLAN,
  LIFE_VALUES_V3,
  labelOf,
} from "@/lib/profile/options";
import { cityLabel } from "@/lib/profile/cities";
import { ageFromDate } from "@/lib/profile/schemas";

export type RevealedProfileData = {
  display_name: string;
  birth_date: string | null;
  city: string | null;
  bio: string | null;
  marital_status: string | null;
  has_children: string | null;
  future_children_plan: string | null;
  religion: string | null;
  top_life_values: string[];
  education: string | null;
  photo_urls: string[];
};

type Props = {
  profile: RevealedProfileData;
  locale?: string;
};

function row(label: string, value: string | null) {
  if (!value) return null;
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: "16px",
        padding: "12px 0",
        borderBottom: "1px solid var(--color-v2-ink-600)",
        fontFamily: "var(--font-v2-body)",
      }}
    >
      <span style={{ fontSize: "13px", color: "var(--color-v2-ink-400)" }}>{label}</span>
      <span
        style={{
          fontSize: "14px",
          color: "var(--color-v2-ink-100)",
          textAlign: "right",
          flex: 1,
          minWidth: 0,
        }}
      >
        {value}
      </span>
    </div>
  );
}

export function RevealedProfile({ profile, locale = "ru" }: Props) {
  const age = profile.birth_date ? ageFromDate(profile.birth_date) : null;
  const photos = profile.photo_urls;
  const valueLabels = profile.top_life_values.map((v) => labelOf(LIFE_VALUES_V3, v, locale));

  return (
    <article>
      {/* Photo carousel (vertical stack для editorial feel) */}
      {photos.length > 0 ? (
        <div style={{ marginBottom: "32px" }}>
          {photos.map((url, i) => (
            <div
              key={i}
              style={{
                aspectRatio: "4 / 5",
                background: "var(--color-v2-ink-600)",
                borderRadius: "var(--v2-radius-md)",
                overflow: "hidden",
                marginBottom: i < photos.length - 1 ? "8px" : 0,
                border: "1px solid var(--color-v2-ink-500)",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt=""
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  display: "block",
                  pointerEvents: "none", // блокируем сохранение через долгое нажатие
                }}
              />
            </div>
          ))}
        </div>
      ) : null}

      {/* Header: name + age */}
      <Headline size="lg" as="h1">
        {profile.display_name}
        {age ? `, ${age}` : ""}
      </Headline>
      {profile.city ? (
        <div
          style={{
            marginTop: "8px",
            fontSize: "14px",
            color: "var(--color-v2-ink-400)",
            fontFamily: "var(--font-v2-body)",
          }}
        >
          {cityLabel(profile.city, locale)}
        </div>
      ) : null}

      {/* Bio */}
      {profile.bio ? (
        <div style={{ marginTop: "28px" }}>
          <div
            style={{
              fontSize: "11px",
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              color: "var(--color-v2-ink-400)",
              marginBottom: "10px",
              fontFamily: "var(--font-v2-body)",
            }}
          >
            О себе
          </div>
          <p
            style={{
              fontFamily: "var(--font-v2-body)",
              fontSize: "16px",
              lineHeight: "1.55",
              color: "var(--color-v2-ink-200)",
              whiteSpace: "pre-wrap",
              margin: 0,
            }}
          >
            {profile.bio}
          </p>
        </div>
      ) : null}

      {/* Values chips */}
      {valueLabels.length > 0 ? (
        <div style={{ marginTop: "28px" }}>
          <div
            style={{
              fontSize: "11px",
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              color: "var(--color-v2-ink-400)",
              marginBottom: "10px",
              fontFamily: "var(--font-v2-body)",
            }}
          >
            Что важно
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
            {valueLabels.map((l, i) => (
              <span
                key={i}
                style={{
                  display: "inline-block",
                  padding: "6px 12px",
                  background: "transparent",
                  border: "1px solid var(--color-v2-ink-500)",
                  borderRadius: "999px",
                  fontSize: "13px",
                  color: "var(--color-v2-ink-200)",
                  fontFamily: "var(--font-v2-body)",
                }}
              >
                {l}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {/* Details rows */}
      <div style={{ marginTop: "32px" }}>
        <div
          style={{
            fontSize: "11px",
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            color: "var(--color-v2-ink-400)",
            marginBottom: "8px",
            fontFamily: "var(--font-v2-body)",
          }}
        >
          Детали
        </div>
        {row("Религия", profile.religion ? labelOf(RELIGION, profile.religion, locale) : null)}
        {row(
          "Семейный статус",
          profile.marital_status ? labelOf(MARITAL_STATUS, profile.marital_status, locale) : null,
        )}
        {row("Дети", profile.has_children ? labelOf(HAS_CHILDREN, profile.has_children, locale) : null)}
        {row(
          "Планы по детям",
          profile.future_children_plan
            ? labelOf(FUTURE_CHILDREN_PLAN, profile.future_children_plan, locale)
            : null,
        )}
        {row("Образование", profile.education ? labelOf(EDUCATION, profile.education, locale) : null)}
      </div>

      {/* Footnote */}
      <Lead style={{ marginTop: "32px", fontSize: "12px", color: "var(--color-v2-ink-400)" }}>
        Профиль доступен после взаимного интереса. Фото нельзя сохранять
        длинным нажатием.
      </Lead>
    </article>
  );
}
