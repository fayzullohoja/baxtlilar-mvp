import { clientNextPath } from "@/lib/state-machine/client-paths";

/**
 * Общий разбор ответа на отправку шага анкеты (клиентская сторона).
 *
 * ПОЧЕМУ этот слой вообще появился. Прод, 12.08.2026: модератор вынес решение,
 * пока человек уже ушёл в анкету (режим shadow-active), сырой UPDATE в RPC
 * переставил ему onboarding_step, и следующий POST шага упёрся в гард -
 * 409 wrong_step (src/lib/onboarding/guard-api.ts). Все 14 форм анкеты
 * показывали на это один общий текст «не удалось сохранить, попробуйте ещё
 * раз», человек жал пять раз подряд и в итоге прошёл 11 шагов заново.
 *
 * Повтор при 409 не помогает НИКОГДА: шаг у человека уже другой, и сам собой он
 * обратно не станет. Значит 409 - это не ошибка сохранения, а отдельный исход:
 * увести человека на его настоящий шаг (сервер кладёт его в поле current) и
 * честно сказать, что введённое здесь не сохранилось.
 *
 * Разбор вынесен в чистую функцию, чтобы правило жило в одном месте на все
 * формы и проверялось тестом без рендер-харнесса (его в проекте нет).
 */
export type StepSubmitOutcome =
  /** Сервер принял шаг. next - куда вести дальше (у загрузки фото его нет). */
  | { kind: "ok"; next?: string; body: Record<string, unknown> }
  /**
   * 409 wrong_step: шаг человека сменился, path - его настоящий экран.
   * dataLost различает два РАЗНЫХ 409 с одинаковым текстом ошибки:
   *  - гард (guard-api.ts) отбивает запрос ДО записи и кладёт в тело current:
   *    введённое человеком не сохранилось, об этом надо сказать;
   *  - tryTransition в конце роута падает уже ПОСЛЕ upsert и current не кладёт:
   *    данные шага записаны, и говорить «не сохранилось» тут нельзя - это была
   *    бы ровно такая же ложь, только в другую сторону.
   */
  | { kind: "step_moved"; path: string; dataLost: boolean }
  /** Всё остальное: валидация, отказ сервера, обрыв сети. Повтор осмыслен. */
  | { kind: "error"; code: string };

/**
 * Код неудачи, который кладёт в тело tryTransition, когда сломалась сама машина
 * переходов (src/lib/state-machine/transitions.ts). Данные шага при этом УЖЕ
 * записаны, а шаг человека НЕ сменился - значит и уводить его никуда нельзя, и
 * говорить «не сохранилось» нельзя. Показываем нейтральное «что-то пошло не
 * так»: повтор здесь как раз осмыслен.
 */
export const TRANSITION_FAILED_CODE = "transition_failed";

function asRecord(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
}

function asString(v: unknown): string | undefined {
  return typeof v === "string" && v ? v : undefined;
}

/** Разбирает пару «HTTP-статус + тело» в один из трёх исходов. */
export function parseStepOutcome(status: number, raw: unknown): StepSubmitOutcome {
  const body = asRecord(raw);
  if (body.ok === true) {
    return { kind: "ok", next: asString(body.next), body };
  }
  if (status === 409 && body.error === "wrong_step") {
    const current = asString(body.current);
    if (current) {
      // Гард: запрос отбит до записи, шаг человека известен из тела.
      // lifecycle сервер тоже кладёт; по умолчанию - онбординг, потому что
      // этот 409 выдаёт именно онбординговый гард.
      const lifecycle = asString(body.lifecycle) ?? "onboarding";
      return { kind: "step_moved", path: clientNextPath(lifecycle, current), dataLost: true };
    }
    // tryTransition в конце роута отбил переход по графу: шаг человека реально
    // сменился (иначе перехода бы не отбили), но какой он теперь - роут не
    // сказал. Ведём в корень, он разведёт человека по его настоящему состоянию.
    // Молча: данные шага записаны до перехода, терять тут нечего.
    //
    // Сюда попадает ТОЛЬКО сменившийся шаг. Поломка самой машины переходов
    // приезжает отдельным кодом transition_failed и разбирается ниже как
    // обычная ошибка - раньше она приходила сюда же, и человека молча уводили в
    // корень, а корень возвращал его на ту же страницу: кнопка «Далее»
    // бесконечно перезагружала экран без единого сообщения.
    return { kind: "step_moved", path: "/", dataLost: false };
  }
  return { kind: "error", code: asString(body.detail) ?? asString(body.error) ?? "failed" };
}

/** Что форма делает с исходом: куда вести и что показывать. */
export type StepSubmitEffect = {
  /** Адрес перехода (уже с меткой объяснения, если шаг сменился) или null. */
  navigateTo: string | null;
  /** Код для баннера ошибки; null - баннера нет. */
  errorCode: string | null;
  /** Шаг сменился: вместо ошибки показываем объяснение. */
  stepMoved: boolean;
};

/**
 * Решение формы по исходу - вынесено из хука, чтобы главное правило («на 409
 * общий текст ошибки не показываем, а уводим на настоящий шаг») проверялось
 * тестом напрямую: рендер-харнесса для .tsx в проекте нет.
 */
export function stepSubmitEffect(outcome: StepSubmitOutcome): StepSubmitEffect {
  if (outcome.kind === "step_moved") {
    // Метку объяснения ставим, только когда введённое реально пропало.
    return {
      navigateTo: outcome.dataLost ? stepMovedHref(outcome.path) : outcome.path,
      errorCode: null,
      stepMoved: outcome.dataLost,
    };
  }
  if (outcome.kind === "error") {
    return { navigateTo: null, errorCode: outcome.code, stepMoved: false };
  }
  return { navigateTo: outcome.next ?? null, errorCode: null, stepMoved: false };
}

/**
 * Разблокировать ли кнопку после исхода.
 *
 * ПОЧЕМУ не «всегда разблокировать». Уходим с экрана - кнопку НЕ отпускаем.
 * router.replace возвращает управление сразу, а страница меняется позже: своего
 * loading.tsx в дереве [locale] нет, поэтому старая форма остаётся на экране и
 * остаётся кликабельной, а надпись на кнопке успевает вернуться с «Сохраняем…»
 * на «Далее». На медленной мобильной сети это секунды. Человек, не увидев
 * реакции, жмёт второй раз - и второй запрос ловит 409 wrong_step, потому что
 * шаг ему уже перевёл первый. Дальше человеку показывают «введённое не
 * сохранилось - заполните заново», хотя первый запрос всё сохранил, и он идёт
 * перезаполнять готовый шаг: ровно тот вред, ради которого всё это чинилось.
 *
 * Так же намеренно устроена кнопка «Назад» (BackButton.tsx).
 */
export function staysOnScreen(effect: StepSubmitEffect): boolean {
  return effect.navigateTo === null;
}

/**
 * Что рисует плашка под формой (AnketaSubmitNotice). Правило одно на все формы:
 * пока стоит stepMoved, общий текст ошибки не показывается вообще.
 */
export function submitNoticeKind(
  errorCode: string | null,
  stepMoved: boolean,
): "step_moved" | "error" | null {
  if (stepMoved) return "step_moved";
  return errorCode ? "error" : null;
}

/**
 * POST шага + разбор ответа. Обрыв сети - обычная ошибка: там повтор как раз
 * помогает, поэтому код "failed", а не step_moved.
 */
export async function postStep(url: string, init: RequestInit): Promise<StepSubmitOutcome> {
  try {
    const res = await fetch(url, init);
    const raw = await res.json().catch(() => ({}));
    return parseStepOutcome(res.status, raw);
  } catch {
    return { kind: "error", code: "failed" };
  }
}

/**
 * Метка «сюда человека увели, потому что шаг сменился» - в адресе экрана.
 *
 * ПОЧЕМУ в адресе, а не в состоянии формы. Объяснение надо показать НА НОВОМ
 * экране: форма, с которой мы уходим, размонтируется сразу после router.replace,
 * и прочитать в ней человек ничего не успеет. Адрес переживает и переход, и
 * перезагрузку мини-аппы, и не требует ни хранилища (в приватных WebView оно
 * бросает), ни эффекта с setState.
 */
export const STEP_MOVED_PARAM = "step_moved";

/** Адрес настоящего шага человека с меткой, по которой экран покажет объяснение. */
export function stepMovedHref(path: string): string {
  return `${path}${path.includes("?") ? "&" : "?"}${STEP_MOVED_PARAM}=1`;
}
