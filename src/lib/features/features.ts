// C-033 — чистые (клиент-безопасные) константы kill-switch'ей. БЕЗ "server-only"
// и без supabaseAdmin, чтобы их можно было импортировать в client-компонент
// (FeatureFlagsPanel). Вся серверная логика (чтение/запись/кэш/гейт) — в flags.ts.

export const FEATURES = ["verification", "matching", "interests", "chat", "payments", "invite_gate"] as const;
export type Feature = (typeof FEATURES)[number];

// Kill switch = фича ВКЛючена по умолчанию (true), админ выключает (false).
// payments — единственное исключение: продукт-решение оунера «платежи OFF на
// MVP», поэтому дефолт false (выключено, пока владелец явно не включит).
export const FEATURE_DEFAULTS: Record<Feature, boolean> = {
  verification: true,
  matching: true,
  interests: true,
  chat: true,
  payments: false,
  // Внимание: у остальных флагов true = "фича работает" (kill switch).
  // Здесь true = "шлагбаум ОПУЩЕН, код обязателен". Дефолт false - вход открыт,
  // как сейчас; включаем вручную, когда очередь модерации разобрана.
  invite_gate: false,
};

export function featureKey(f: Feature): string {
  return `feature_${f}_enabled`;
}

/**
 * Флаги, для которых сбой ЧТЕНИЯ app_settings обязан трактоваться как "закрыто",
 * а не как обычный fail-open к дефолту (см. loadFeatureFlags в ./flags).
 *
 * Для обычных рубильников (verification/matching/interests/chat/payments) true
 * значит "фича работает" - их дефолт УЖЕ безопасен на сбое: fail-open к дефолту
 * либо держит продукт живым (verification/matching/interests/chat), либо не
 * трогает продуктовое решение "payments выключен, пока не включат явно"
 * (дефолт payments и так false). Незнание состояния для них не опаснее, чем
 * штатная работа по дефолту.
 *
 * У invite_gate смысл ПЕРЕВЁРНУТ: true значит "шлагбаум ОПУЩЕН, код обязателен"
 * (см. комментарий у FEATURE_DEFAULTS.invite_gate выше), а дефолт false значит
 * "шлагбаум поднят, вход открыт". Fail-open к дефолту здесь означало бы "не
 * знаем состояние защиты - предположим, что шлагбаум поднят" - то есть
 * транзиентный сбой БД (обрыв соединения, исчерпан пул, таймаут) молча
 * открывал бы вход всем в закрытый запуск. Для защитного механизма незнание
 * обязано читаться как "закрыто" (шлагбаум опущен, код обязателен):
 * перечисленные здесь флаги на сбое чтения принудительно становятся true,
 * ЧТО БЫ НИ ГОВОРИЛ их дефолт.
 */
export const FAIL_CLOSED_FEATURES: readonly Feature[] = ["invite_gate"];
