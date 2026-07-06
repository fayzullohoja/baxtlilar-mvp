/**
 * V2 MatchStoryCard — editorial карточка с объяснением алгоритма.
 *
 * Источник истины (продуктовое решение): см. memory
 * [[project-baxtlilar-v2-matching-model]] (2026-06-25).
 *
 * Три секции в editorial-разрезе:
 *   1. «Почему мы думаем, что вы совпадаете» — reasons (positive)
 *   2. «На что стоит обратить внимание»     — cautions (friction)
 *   3. «Совет от системы»                    — 1 предложение для диалога
 *
 * Не показываем "score" или процент совпадения. Это качественный
 * нарратив, а не количественная оценка.
 */

import type { MatchStory } from "@/lib/v2/match-story";
import { Headline } from "./Headline";

type Props = {
  story: MatchStory;
  /** Имя кандидата для персонализации advice */
  candidateName: string;
};

function Section({
  title,
  items,
  marker = "check",
}: {
  title: string;
  items: string[];
  /** check — гранатовый кружок с ✓; note — янтарный кружок с ! («На заметку») */
  marker?: "check" | "note";
}) {
  if (!items.length) return null;
  const markerBg =
    marker === "note" ? "var(--v2-grad-amber)" : "var(--v2-grad-primary)";
  return (
    <div style={{ marginTop: "24px" }}>
      <div
        style={{
          fontSize: "12px",
          fontWeight: 800,
          textTransform: "uppercase",
          letterSpacing: "0.14em",
          color: "var(--color-v2-accent)",
          marginBottom: "10px",
          fontFamily: "var(--font-v2-body)",
        }}
      >
        {title}
      </div>
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {items.map((item, i) => (
          <li
            key={i}
            style={{
              fontFamily: "var(--font-v2-body)",
              fontSize: "15px",
              lineHeight: "1.55",
              color: "var(--color-v2-ink-200)",
              marginBottom: "10px",
              paddingLeft: "26px",
              position: "relative",
            }}
          >
            <span
              aria-hidden
              style={{
                position: "absolute",
                left: 0,
                top: "3px",
                width: "17px",
                height: "17px",
                borderRadius: "999px",
                background: markerBg,
                color: "#ffffff",
                fontSize: "10px",
                fontWeight: 800,
                lineHeight: "17px",
                textAlign: "center",
              }}
            >
              {marker === "note" ? "!" : "✓"}
            </span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function MatchStoryCard({ story, candidateName }: Props) {
  const noContent = !story.reasons.length && !story.cautions.length && !story.advice;
  if (noContent) return null;

  return (
    <section
      className="v2-rise"
      style={{
        background: "linear-gradient(160deg, #FFF7F0, #FBEDE4)",
        border: "1px solid #F3D7CB",
        borderRadius: "var(--v2-radius-card)",
        boxShadow: "var(--v2-shadow-card)",
        padding: "26px 20px 24px",
        marginTop: "16px",
      }}
    >
      <div
        style={{
          fontSize: "12px",
          fontWeight: 800,
          textTransform: "uppercase",
          letterSpacing: "0.14em",
          color: "var(--color-v2-accent)",
          marginBottom: "10px",
          fontFamily: "var(--font-v2-body)",
        }}
      >
        Подбор от системы
      </div>
      <Headline size="md" as="h3">
        Почему мы предлагаем {candidateName}.
      </Headline>

      <Section title="Что у Вас общего" items={story.reasons} marker="check" />
      <Section title="На что обратить внимание" items={story.cautions} marker="note" />

      {story.advice ? (
        <div
          style={{
            marginTop: "24px",
            background: "var(--color-v2-chip-teal)",
            borderRadius: "14px",
            padding: "14px 16px",
          }}
        >
          <div
            style={{
              fontSize: "12px",
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: "0.14em",
              color: "var(--color-v2-chip-teal-ink)",
              marginBottom: "8px",
              fontFamily: "var(--font-v2-body)",
            }}
          >
            Если откроется чат
          </div>
          <p
            style={{
              fontFamily: "var(--font-v2-body)",
              fontSize: "14.5px",
              fontWeight: 600,
              lineHeight: "1.55",
              color: "var(--color-v2-chip-teal-ink)",
              margin: 0,
              fontStyle: "italic",
            }}
          >
            {story.advice}
          </p>
        </div>
      ) : null}
    </section>
  );
}
