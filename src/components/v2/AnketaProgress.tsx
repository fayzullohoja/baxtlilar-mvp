import { getTranslations } from "next-intl/server";
import type { AnketaProgress as Progress } from "@/lib/onboarding/anketa-progress";

/**
 * Фаза 6 (§3) — прогресс-бар анкеты в стиле Duolingo: заполняемая полоса (%) +
 * «Шаг N из M» + мотивашка у финиша. Серверный компонент (без интерактива),
 * рендерится в MiniAppShell под eyebrow. Копи — редактируемые i18n-ключи
 * (Anketa.progress_step / progress_almost_done), оунер может править в /admin/content.
 */
export async function AnketaProgress({ progress }: { progress: Progress }) {
  const t = await getTranslations("Anketa");
  const { current, total, percent } = progress;
  const almostDone = total - current <= 2; // последние 3 шага

  return (
    <div style={{ marginBottom: "24px" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: "8px",
        }}
      >
        <span
          style={{
            fontSize: "12px",
            fontWeight: 700,
            color: "var(--color-v2-ink-300)",
            fontFamily: "var(--font-v2-body)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {t("progress_step", { current, total })}
        </span>
        {almostDone ? (
          <span
            style={{
              fontSize: "12px",
              fontWeight: 800,
              color: "var(--color-v2-accent)",
              fontFamily: "var(--font-v2-body)",
            }}
          >
            {t("progress_almost_done")}
          </span>
        ) : null}
      </div>
      <div
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        style={{
          height: "8px",
          borderRadius: "999px",
          background: "var(--color-v2-ink-500)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${percent}%`,
            height: "100%",
            borderRadius: "999px",
            background: "var(--v2-grad-primary)",
            transition: "width 0.4s ease",
          }}
        />
      </div>
    </div>
  );
}
