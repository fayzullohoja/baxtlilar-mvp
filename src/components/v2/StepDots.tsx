/**
 * V2 StepDots — минималистичный прогресс-индикатор для tutorial-тура.
 *
 * Editorial DNA: точки, не bar. Активная — заполнена ink, пройденные — outline,
 * будущие — приглушённые ink-500. Никаких процентов.
 */

type Props = {
  total: number;
  current: number; // 1-based
};

export function StepDots({ total, current }: Props) {
  return (
    <div className="flex gap-2 mb-8">
      {Array.from({ length: total }).map((_, i) => {
        const n = i + 1;
        const isActive = n === current;
        const isPast = n < current;
        return (
          <div
            key={i}
            style={{
              width: isActive ? "24px" : "6px",
              height: "6px",
              borderRadius: "3px",
              background: isActive
                ? "var(--color-v2-ink-100)"
                : isPast
                  ? "var(--color-v2-ink-300)"
                  : "var(--color-v2-ink-500)",
              transition: "all 0.2s ease",
            }}
          />
        );
      })}
    </div>
  );
}
