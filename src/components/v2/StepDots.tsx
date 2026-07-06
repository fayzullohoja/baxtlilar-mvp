/**
 * V2 StepDots — минималистичный прогресс-индикатор для tutorial-тура.
 *
 * «Живой Baxtlilar»: точки, не bar. Активная — гранатово-янтарный градиент,
 * пройденные — гранатовый акцент, будущие — hairline ink-500. Никаких процентов.
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
              width: isActive ? "24px" : "7px",
              height: "7px",
              borderRadius: "99px",
              background: isActive
                ? "linear-gradient(90deg, #C1362F, #E9A23B)"
                : isPast
                  ? "var(--color-v2-accent)"
                  : "var(--color-v2-ink-500)",
              transition: "all 0.2s ease",
            }}
          />
        );
      })}
    </div>
  );
}
