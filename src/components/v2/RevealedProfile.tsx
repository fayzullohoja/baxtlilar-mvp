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

"use client";

import { useTranslations } from "next-intl";
import { useOptLabel } from "./useOptLabel";
import { Headline, Lead } from "./Headline";
import {
  EDUCATION,
  RELIGION,
  MARITAL_STATUS,
  HAS_CHILDREN,
  FUTURE_CHILDREN_PLAN,
  LIFE_VALUES_V3,
} from "@/lib/profile/options";
import { cityLabel } from "@/lib/profile/cities";
import { ageFromDate } from "@/lib/profile/schemas";
import { thumb } from "@/lib/storage/thumb-url";

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
        borderBottom: "1px solid var(--color-v2-border)",
        fontFamily: "var(--font-v2-body)",
      }}
    >
      <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--color-v2-ink-400)" }}>{label}</span>
      <span
        style={{
          fontSize: "14px",
          fontWeight: 600,
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

/** Eyebrow-подзаголовок секции. */
const sectionLabelStyle: React.CSSProperties = {
  fontSize: "12px",
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: "0.14em",
  color: "var(--color-v2-accent)",
  marginBottom: "10px",
  fontFamily: "var(--font-v2-body)",
};

export function RevealedProfile({ profile, locale = "ru" }: Props) {
  const t = useTranslations("Profile");
  // Tier 2: лейблы вариантов — редактируемые строки Options.* (fallback → options.ts)
  const { labelOf: optLabelOf } = useOptLabel(locale);
  const age = profile.birth_date ? ageFromDate(profile.birth_date) : null;
  const photos = profile.photo_urls;
  const values = profile.top_life_values.map((v) => ({
    key: v,
    label: optLabelOf(LIFE_VALUES_V3, v),
  }));

  return (
    <article className="v2-rise">
      {/* Photo carousel (vertical stack для editorial feel) */}
      {photos.length > 0 ? (
        <div style={{ marginBottom: "32px" }}>
          {photos.map((url, i) => (
            <div
              key={i}
              style={{
                aspectRatio: "4 / 5",
                background: "var(--v2-grad-brand)",
                borderRadius: "var(--v2-radius-lg)",
                overflow: "hidden",
                marginBottom: i < photos.length - 1 ? "8px" : 0,
                boxShadow: "var(--v2-shadow-card)",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                // Фото на всю ширину экрана: 1280 держит резкость даже на 3x,
                // но весит десятки килобайт вместо мегабайт оригинала.
                src={thumb(url, 1280) ?? url}
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
          <div style={sectionLabelStyle}>{t("bioLabel")}</div>
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

      {/* Values chips (вера → teal-чип) */}
      {values.length > 0 ? (
        <div style={{ marginTop: "28px" }}>
          <div style={sectionLabelStyle}>{t("lifeValuesLabel")}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
            {values.map((v, i) => {
              const teal = v.key === "faith";
              return (
                <span
                  key={i}
                  style={{
                    display: "inline-block",
                    padding: "7px 13px",
                    background: teal ? "var(--color-v2-chip-teal)" : "var(--color-v2-chip)",
                    borderRadius: "999px",
                    fontSize: "13px",
                    fontWeight: 600,
                    color: teal ? "var(--color-v2-chip-teal-ink)" : "var(--color-v2-chip-ink)",
                    fontFamily: "var(--font-v2-body)",
                  }}
                >
                  {v.label}
                </span>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* Details rows */}
      <div style={{ marginTop: "32px" }}>
        <div style={{ ...sectionLabelStyle, marginBottom: "8px" }}>
          {t("detailsLabel")}
        </div>
        {row(t("religionLabel"), profile.religion ? optLabelOf(RELIGION, profile.religion) : null)}
        {row(
          t("maritalStatusLabel"),
          profile.marital_status ? optLabelOf(MARITAL_STATUS, profile.marital_status) : null,
        )}
        {row(t("childrenLabel"), profile.has_children ? optLabelOf(HAS_CHILDREN, profile.has_children) : null)}
        {row(
          t("childrenPlansLabel"),
          profile.future_children_plan
            ? optLabelOf(FUTURE_CHILDREN_PLAN, profile.future_children_plan)
            : null,
        )}
        {row(t("educationLabel"), profile.education ? optLabelOf(EDUCATION, profile.education) : null)}
      </div>

      {/* Footnote */}
      <Lead style={{ marginTop: "32px", fontSize: "12px", color: "var(--color-v2-ink-400)" }}>
        {t("profileFootnote")}
      </Lead>
    </article>
  );
}
