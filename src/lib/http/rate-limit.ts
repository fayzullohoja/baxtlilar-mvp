/**
 * SEC-3a — глобальный rate-limit (token-bucket), in-memory.
 *
 * Работает в proxy.ts (Next 16 middleware). Деплой — ОДИН Railway-инстанс
 * (`next start`), поэтому in-memory Map корректен: все запросы проходят через
 * один процесс. При переходе на реплики (после выноса storage в R2/S3) лимитер
 * надо переносить на общий стор (Redis/Postgres) — см. launch-readiness §E.
 * Состояние теряется при рестарте — приемлемо (защита от флуда, не квота).
 *
 * Два слоя для /api:
 *   - per-IP (широкий): CGNAT мобильных операторов РУз прячет много юзеров за
 *     одним IP — IP-ведро только против грубого флуда с одной машины;
 *   - per-session (точечный): bx_session-хэш — реальный «один юзер».
 * /api/auth/bootstrap — своё жёсткое per-IP ведро (сессии ещё нет).
 * health / telegram-webhook / cron / storage исключены: health дёргает
 * uptime-монитор, webhook защищён secret'ом (и это трафик серверов TG),
 * cron — X-Cron-Secret, storage — подписанные HMAC-URL с высоким легальным QPS.
 */

export type BucketConfig = {
  /** Максимум токенов (burst). */
  capacity: number;
  /** Скорость восстановления, токенов в секунду (sustained rate). */
  refillPerSec: number;
};

type BucketState = { tokens: number; updatedAt: number };

export class TokenBucketLimiter {
  private buckets = new Map<string, BucketState>();

  constructor(
    private cfg: BucketConfig,
    private maxKeys = 50_000,
  ) {}

  get size(): number {
    return this.buckets.size;
  }

  /** true — токен снят (запрос разрешён); false — лимит исчерпан. */
  take(key: string, now = Date.now()): boolean {
    let b = this.buckets.get(key);
    if (!b) {
      if (this.buckets.size >= this.maxKeys) this.sweep(now);
      b = { tokens: this.cfg.capacity, updatedAt: now };
      this.buckets.set(key, b);
    } else {
      const elapsedSec = Math.max(0, now - b.updatedAt) / 1000;
      b.tokens = Math.min(this.cfg.capacity, b.tokens + elapsedSec * this.cfg.refillPerSec);
      b.updatedAt = now;
    }
    if (b.tokens < 1) return false;
    b.tokens -= 1;
    return true;
  }

  /** Через сколько секунд появится следующий токен (для Retry-After). */
  retryAfterSec(): number {
    return Math.max(1, Math.ceil(1 / this.cfg.refillPerSec));
  }

  /** Анти-DoS по кардинальности ключей: чистим простаивающие вёдра. */
  private sweep(now: number): void {
    // Ведро, простоявшее дольше полного restore, эквивалентно отсутствующему.
    const idleMs = (this.cfg.capacity / this.cfg.refillPerSec) * 1000;
    for (const [k, b] of this.buckets) {
      if (now - b.updatedAt > idleMs) this.buckets.delete(k);
    }
    // Активное распухание (спуф множества ключей) — жёсткий сброс дешевле OOM.
    if (this.buckets.size >= this.maxKeys) this.buckets.clear();
  }
}

// =============================================================================
// Классы путей
// =============================================================================

export type PathClass = "exempt" | "bootstrap" | "api" | "page";

export function classifyPath(pathname: string): PathClass {
  if (
    pathname === "/api/health" ||
    pathname === "/api/telegram/webhook" ||
    pathname.startsWith("/api/cron/") ||
    pathname.startsWith("/api/storage/o/")
  ) {
    return "exempt";
  }
  if (pathname.startsWith("/api/auth/bootstrap")) return "bootstrap";
  if (pathname.startsWith("/api/")) return "api";
  return "page";
}

// =============================================================================
// Вёдра (калибровка — см. docs/launch-readiness §E и SEC-3a приёмку:
// чат-поллинг 1.5с не должен ловить 429; CGNAT-IP — широкий)
// =============================================================================

// Один юзер: поллинг чата ~0.7 rps + typing/read/навигация пиками до ~8 rps.
const SESSION_API: BucketConfig = { capacity: 60, refillPerSec: 10 };
// IP с CGNAT (десятки юзеров): floor против однохостового флуда.
const IP_API: BucketConfig = { capacity: 600, refillPerSec: 60 };
// bootstrap: раз за вход в mini-app; burst 30 покрывает «класс за одним IP»,
// sustained 1 в 2с делает перебор start-токенов бессмысленным.
const IP_BOOTSTRAP: BucketConfig = { capacity: 30, refillPerSec: 0.5 };
// HTML-страницы (SSR дороже API-джсона).
const IP_PAGE: BucketConfig = { capacity: 240, refillPerSec: 30 };

let sessionApiLimiter = new TokenBucketLimiter(SESSION_API);
let ipApiLimiter = new TokenBucketLimiter(IP_API);
let ipBootstrapLimiter = new TokenBucketLimiter(IP_BOOTSTRAP);
let ipPageLimiter = new TokenBucketLimiter(IP_PAGE);

export function resetRateLimitersForTests(): void {
  sessionApiLimiter = new TokenBucketLimiter(SESSION_API);
  ipApiLimiter = new TokenBucketLimiter(IP_API);
  ipBootstrapLimiter = new TokenBucketLimiter(IP_BOOTSTRAP);
  ipPageLimiter = new TokenBucketLimiter(IP_PAGE);
}

/** Быстрый некриптографический хэш (djb2): не хранить сырой session-токен как ключ. */
function keyHash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

export type RateDecision = { allowed: true } | { allowed: false; retryAfterSec: number };

export function checkRateLimit(
  req: { pathname: string; ip: string; sessionValue: string | null },
  now = Date.now(),
): RateDecision {
  const cls = classifyPath(req.pathname);
  if (cls === "exempt") return { allowed: true };

  if (cls === "bootstrap") {
    return ipBootstrapLimiter.take(`b:${req.ip}`, now)
      ? { allowed: true }
      : { allowed: false, retryAfterSec: ipBootstrapLimiter.retryAfterSec() };
  }

  if (cls === "api") {
    if (!ipApiLimiter.take(`i:${req.ip}`, now)) {
      return { allowed: false, retryAfterSec: ipApiLimiter.retryAfterSec() };
    }
    if (req.sessionValue && !sessionApiLimiter.take(`s:${keyHash(req.sessionValue)}`, now)) {
      return { allowed: false, retryAfterSec: sessionApiLimiter.retryAfterSec() };
    }
    return { allowed: true };
  }

  return ipPageLimiter.take(`p:${req.ip}`, now)
    ? { allowed: true }
    : { allowed: false, retryAfterSec: ipPageLimiter.retryAfterSec() };
}
