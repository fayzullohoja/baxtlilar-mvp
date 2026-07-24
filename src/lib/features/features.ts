// C-033 — чистые (клиент-безопасные) константы kill-switch'ей. БЕЗ "server-only"
// и без supabaseAdmin, чтобы их можно было импортировать в client-компонент
// (FeatureFlagsPanel). Вся серверная логика (чтение/запись/кэш/гейт) — в flags.ts.

export const FEATURES = ["verification", "matching", "interests", "chat", "payments"] as const;
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
};

export function featureKey(f: Feature): string {
  return `feature_${f}_enabled`;
}
