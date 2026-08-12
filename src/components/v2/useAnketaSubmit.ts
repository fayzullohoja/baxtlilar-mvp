"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import {
  postStep,
  staysOnScreen,
  stepSubmitEffect,
  type StepSubmitOutcome,
} from "@/lib/onboarding/submit-step";

/** Тело шага: обычная форма шлёт JSON, загрузка фото - FormData, publish - ничего. */
export type StepPayload = Record<string, unknown> | FormData | undefined;

/** Метод запроса. DELETE нужен удалению фото - оно ходит через тот же слой. */
export type StepMethod = "POST" | "DELETE";

function buildInit(payload: StepPayload, method: StepMethod): RequestInit {
  if (payload instanceof FormData) return { method, body: payload };
  if (payload === undefined) {
    return { method, headers: { "content-type": "application/json" } };
  }
  return {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  };
}

/**
 * Единая отправка шага анкеты для всех форм.
 *
 * ПОЧЕМУ один хук на 14 форм. Раньше каждая форма повторяла свой fetch и сама
 * решала, что показать при неудаче, - и все 14 одинаково ошибались на 409
 * wrong_step: рисовали «не удалось сохранить, попробуйте ещё раз». Повтор при
 * 409 не помогает никогда (см. submit-step.ts), но исправить это в 14 местах
 * означало бы 14 шансов забыть одно. Теперь правило живёт здесь.
 *
 * Что делает при смене шага: уводит человека на его настоящий экран и ставит в
 * адрес метку объяснения. Общий текст ошибки при этом НЕ выставляется - вместо
 * «попробуйте ещё раз» человек получает честное объяснение на новом экране.
 */
export function useAnketaSubmit(url: string) {
  const router = useRouter();
  // busy держим и в ref: два быстрых клика попадают в один рендер, и проверка
  // по состоянию их не поймает.
  const busyRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [stepMoved, setStepMoved] = useState(false);

  /**
   * Отправка на произвольный адрес. Нужна экрану фото: там два разных роута
   * (загрузка снимка и «готово»), но состояние busy/ошибки у формы одно.
   */
  const submitTo = useCallback(
    async (
      target: string,
      payload?: StepPayload,
      method: StepMethod = "POST",
    ): Promise<StepSubmitOutcome> => {
      if (busyRef.current) return { kind: "error", code: "busy" };
      busyRef.current = true;
      setBusy(true);
      setErrorCode(null);
      setStepMoved(false);
      const outcome = await postStep(target, buildInit(payload, method));
      // Решение целиком в stepSubmitEffect - там же оно и протестировано.
      // Метка объяснения едет в адресе: эта форма после replace размонтируется,
      // читать баннер человеку будет негде.
      const effect = stepSubmitEffect(outcome);
      setStepMoved(effect.stepMoved);
      setErrorCode(effect.errorCode);
      if (effect.navigateTo) router.replace(effect.navigateTo);
      // Кнопку отпускаем, только если человек остаётся на этом экране (правило и
      // причина - в staysOnScreen). Уходим - держим нажатой до конца перехода:
      // иначе второй тап по «Далее» уедет на сервер уже с переведённым шагом,
      // получит 409 и человеку соврут, что введённое пропало.
      if (staysOnScreen(effect)) {
        busyRef.current = false;
        setBusy(false);
      }
      return outcome;
    },
    [router],
  );

  const submit = useCallback(
    (payload?: StepPayload) => submitTo(url, payload),
    [submitTo, url],
  );

  return { busy, errorCode, stepMoved, setErrorCode, submit, submitTo };
}
