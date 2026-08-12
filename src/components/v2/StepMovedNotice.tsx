"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { STEP_MOVED_PARAM } from "@/lib/onboarding/submit-step";

/** Общий вид плашки «шаг сменился» - одинаковый и внутри формы, и на новом экране. */
export const stepMovedBoxStyle: React.CSSProperties = {
  padding: "10px 14px",
  background: "#FDF3E3",
  borderLeft: "3px solid #C8892E",
  borderRadius: "12px",
  fontSize: "13px",
  lineHeight: "1.5",
  color: "#7A5314",
  marginBottom: "16px",
};

function StepMovedBanner() {
  const params = useSearchParams();
  const t = useTranslations();
  const show = params.get(STEP_MOVED_PARAM) === "1";
  // Обёртка с role="status" рендерится всегда, а текст появляется внутри неё:
  // живую область экранный диктор должен видеть ДО того, как в ней возникнет
  // содержимое, иначе объяснение он просто не озвучит.
  return (
    <div role="status" aria-live="polite">
      {show ? (
        <div style={{ ...stepMovedBoxStyle, marginBottom: "20px" }}>
          {t("Common.step_moved_notice")}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Объяснение на экране, куда человека увели после 409 wrong_step.
 *
 * ПОЧЕМУ отдельным экраном, а не баннером в форме: форма размонтируется сразу
 * после перехода, прочитать в ней ничего нельзя. Метку в адрес ставит
 * useAnketaSubmit, здесь она только читается - ни состояния, ни эффекта.
 *
 * Текст намеренно НЕ обещает, что данные сохранены: на том шаге они не
 * сохранились, и врать про это нельзя.
 *
 * Suspense нужен из-за useSearchParams: без него страница, которую Next решит
 * отрендерить статически, свалит сборку.
 */
export function StepMovedNotice() {
  return (
    <Suspense fallback={null}>
      <StepMovedBanner />
    </Suspense>
  );
}
