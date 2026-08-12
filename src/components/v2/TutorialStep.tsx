"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/v2/Button";
import { AnketaSubmitNotice } from "./AnketaSubmitNotice";
import { useAnketaSubmit } from "./useAnketaSubmit";

type Props = {
  cta: string;
  ctaPending?: string;
  /** Если задан — рядом с primary показывается ghost skip-кнопка → ready. */
  showSkip?: boolean;
};

/**
 * Continue-кнопка для tutorial-экранов. POST на /api/onboarding/tutorial с
 * текущим шагом — сервер сам знает следующий по ALLOWED_TRANSITIONS и
 * редиректит на нужный путь.
 *
 * Skip всегда ведёт в "ready" (одной кнопкой минуем оставшиеся шаги).
 *
 * Отправка через общий слой (useAnketaSubmit). ПОЧЕМУ: тур гейтится тем же
 * гардом, что и анкета, и так же отдаёт 409 wrong_step - например когда оператор
 * нажал «перезапустить онбординг». Раньше отказ здесь обрабатывался как
 * `if (!res.ok) return;`: кнопка «Далее» молча не делала НИЧЕГО, ни текста, ни
 * перехода, и человек оставался на экране тура навсегда. Теперь на смену шага
 * его уводят на настоящий экран, а на настоящую ошибку он хотя бы видит текст.
 */
export function TutorialStep({
  cta,
  ctaPending,
  showSkip = true,
}: Props) {
  const t = useTranslations("Tutorial");
  const tc = useTranslations("Common");
  const { busy, errorCode, stepMoved, submit } = useAnketaSubmit("/api/onboarding/tutorial");

  // Своих текстов ошибок у тура нет: тут нечего сохранять, поэтому нейтральное
  // «что-то пошло не так» - честнее, чем «не удалось сохранить».
  const ERR_COPY: Record<string, string> = { failed: tc("error_generic") };

  function advance(skip: boolean) {
    if (busy) return;
    void submit({ skip });
  }

  return (
    <div className="flex flex-col gap-2">
      <AnketaSubmitNotice errorCode={errorCode} stepMoved={stepMoved} errorCopy={ERR_COPY} />
      <Button onClick={() => advance(false)} disabled={busy} variant="primary">
        {busy ? (ctaPending ?? t("pending")) : cta}
      </Button>
      {showSkip ? (
        <Button onClick={() => advance(true)} disabled={busy} variant="ghost">
          {t("skipTour")}
        </Button>
      ) : null}
    </div>
  );
}
