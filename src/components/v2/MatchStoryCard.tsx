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
}: {
  title: string;
  items: string[];
}) {
  if (!items.length) return null;
  return (
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
              paddingLeft: "16px",
              position: "relative",
            }}
          >
            <span
              style={{
                position: "absolute",
                left: 0,
                top: "10px",
                width: "6px",
                height: "1px",
                background: "var(--color-v2-ink-300)",
              }}
            />
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
      style={{
        background: "var(--color-v2-paper)",
        border: "1px solid var(--color-v2-ink-500)",
        borderRadius: "var(--v2-radius-lg)",
        padding: "32px 24px",
        marginTop: "24px",
      }}
    >
      <div
        style={{
          fontSize: "11px",
          textTransform: "uppercase",
          letterSpacing: "0.12em",
          color: "var(--color-v2-ink-400)",
          marginBottom: "12px",
          fontFamily: "var(--font-v2-body)",
        }}
      >
        Подбор от системы
      </div>
      <Headline size="md" as="h3">
        Почему мы предлагаем {candidateName}.
      </Headline>

      <Section title="Что у Вас общего" items={story.reasons} />
      <Section title="На что обратить внимание" items={story.cautions} />

      {story.advice ? (
        <div
          style={{
            marginTop: "28px",
            paddingTop: "20px",
            borderTop: "1px solid var(--color-v2-ink-500)",
          }}
        >
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
            Если откроется чат
          </div>
          <p
            style={{
              fontFamily: "var(--font-v2-body)",
              fontSize: "15px",
              lineHeight: "1.55",
              color: "var(--color-v2-ink-200)",
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
