"use client";
import { useCallback, useRef, useState } from "react";

/**
 * Один примитив для всех операторских действий админки (POST → обновить экран).
 *
 * Появился после аудита 08.08.2026, где один и тот же дефект нашёлся копипастой
 * в трёх компонентах: `busy` выставлялся в true, снимался в ветке ОШИБКИ, но не
 * на УСПЕХЕ — после первого удачного действия вся панель оставалась
 * заблокированной до перезагрузки страницы (DangerZone, ClientsTable,
 * ReportTriageActions). Ещё два места вообще не проверяли ответ сервера
 * (PhotosScreen, ReportTriageActions#2) — провал был неотличим от успеха.
 *
 * Гарантии: busy снимается ВСЕГДА (finally), повторный запуск во время полёта
 * игнорируется (защита от двойного клика), ошибка всегда попадает в error.
 */
export type AsyncAction = {
  busy: boolean;
  error: string | null;
  setError: (e: string | null) => void;
  /** Выполнить действие. Бросок внутри fn → текст ошибки в error. */
  run: (fn: () => Promise<void>) => Promise<void>;
};

export function useAsyncAction(): AsyncAction {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  const run = useCallback(async (fn: () => Promise<void>) => {
    if (inFlight.current) return; // двойной клик — игнорируем
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось выполнить действие.");
    } finally {
      inFlight.current = false;
      setBusy(false); // ← снимается и на успехе тоже
    }
  }, []);

  return { busy, error, setError, run };
}

/**
 * POST на админский эндпоинт с разбором общего для них ответа `{ok, error}`.
 * Бросает Error с человекочитаемым текстом — ловит useAsyncAction.
 * Молчаливый провал невозможен: не-ok ответ и сетевой сбой одинаково бросают.
 */
export async function postAdminAction(
  url: string,
  body?: unknown,
  errorMap?: Record<string, string>,
): Promise<void> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
    });
  } catch {
    throw new Error("Сеть недоступна. Проверьте соединение и повторите.");
  }
  const d = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
  if (!d.ok) {
    const code = d.error ?? "";
    throw new Error(errorMap?.[code] ?? code ?? `Ошибка сервера (${res.status})`);
  }
}
