"use client";

import { useTranslations } from "next-intl";
import { submitNoticeKind, TRANSITION_FAILED_CODE } from "@/lib/onboarding/submit-step";
import { stepMovedBoxStyle } from "./StepMovedNotice";

const errorBoxStyle: React.CSSProperties = {
  padding: "10px 14px",
  background: "#FBE7E4",
  borderLeft: "3px solid var(--color-v2-danger)",
  borderRadius: "12px",
  fontSize: "13px",
  color: "#9A4B46",
  fontFamily: "var(--font-v2-body)",
  marginBottom: "16px",
  lineHeight: "1.5",
};

/**
 * Плашка под формой анкеты: либо смена шага, либо настоящая ошибка.
 *
 * ПОЧЕМУ два разных случая в одном месте. Раньше каждая форма рисовала одну
 * красную плашку «не удалось сохранить, попробуйте ещё раз» на любую неудачу,
 * включая 409 wrong_step, где повтор бесполезен. Здесь эти два случая
 * разведены явно, и разойтись по 14 формам они больше не могут.
 *
 * stepMoved показываем как запасной вариант: обычно человек уже уехал на свой
 * настоящий экран (там объяснение рисует StepMovedNotice), но если переход
 * задержался, форма не должна выглядеть молча сломанной.
 */
export function AnketaSubmitNotice({
  errorCode,
  stepMoved = false,
  errorCopy,
}: {
  errorCode: string | null;
  stepMoved?: boolean;
  /** Тексты кодов ошибок конкретной формы; ключ "failed" - запасной. */
  errorCopy?: Record<string, string>;
}) {
  const t = useTranslations();
  const kind = submitNoticeKind(errorCode, stepMoved);

  if (kind === "step_moved") {
    return (
      <div role="status" style={stepMovedBoxStyle}>
        {t("Common.step_moved_notice")}
      </div>
    );
  }
  if (kind !== "error" || !errorCode) return null;
  // Сломалась машина переходов: данные шага роут записал ДО перехода, поэтому
  // общий текст «не получилось сохранить» здесь врал бы - человек пошёл бы
  // перезаполнять готовый шаг. Говорим нейтральное «что-то пошло не так»:
  // повтор в этом случае как раз осмыслен.
  const text =
    errorCopy?.[errorCode] ??
    (errorCode === TRANSITION_FAILED_CODE ? t("Common.error_generic") : undefined) ??
    errorCopy?.failed ??
    t("Anketa.err_failed");
  return <div style={errorBoxStyle}>{text}</div>;
}
