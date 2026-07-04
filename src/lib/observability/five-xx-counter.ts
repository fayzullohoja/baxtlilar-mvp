/**
 * OBS-5 — скользящий 5-минутный счётчик 5xx (unhandled server errors).
 *
 * In-memory, single-instance (как rate-limit): корректно, пока один Railway
 * инстанс. Теряется при рестарте — приемлемо (сигнал тренда для алертов, не
 * биллинг). Инкремент — из instrumentation onRequestError (Next 16 ловит
 * необработанные ошибки Route Handlers / Server Components = 500). Явные
 * NextResponse.json(…,{status:5xx}) сюда НЕ попадают — задокументировано.
 */

const WINDOW_MS = 5 * 60 * 1000;
let events: number[] = [];

export function record5xx(now = Date.now()): void {
  events.push(now);
  prune(now);
}

export function count5xxLast5min(now = Date.now()): number {
  prune(now);
  return events.length;
}

function prune(now: number): void {
  const cutoff = now - WINDOW_MS;
  if (events.length && events[0] < cutoff) {
    events = events.filter((t) => t >= cutoff);
  }
}

export function resetFiveXxForTests(): void {
  events = [];
}
