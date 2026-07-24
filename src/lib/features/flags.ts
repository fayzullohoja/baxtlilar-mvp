import "server-only";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { unwrapRows } from "@/lib/db/unwrap";
import { FEATURES, FEATURE_DEFAULTS, featureKey, type Feature } from "./features";

/**
 * C-033 — Feature kill switches (§67 «немедленное отключение»).
 *
 * Пять критичных подсистем можно выключить БЕЗ деплоя: значение флага живёт в
 * app_settings (ключ feature_<name>_enabled) и читается на входе фичи в рантайме,
 * а не константой сборки. Переключение — super-only роут /api/admin/features,
 * атомарно через RPC set_feature_flag + запись в admin_audit_log.
 *
 * Гейт стоит на эшелоне приложения (не в RPC): G-26 просит независимого
 * выключения каждой фичи, а не defense-in-depth в БД — последнее сильно
 * инвазивнее и картой не требуется.
 *
 * Чистые константы (FEATURES/FEATURE_DEFAULTS/featureKey/Feature) живут в
 * ./features (без "server-only"), чтобы client-панель могла их импортировать.
 * Реэкспортим для существующих серверных импортёров.
 */
export { FEATURES, FEATURE_DEFAULTS, featureKey };
export type { Feature };

// Кэш: избегаем DB-хита на КАЖДЫЙ запрос фичи. TTL определяет реальную задержку
// срабатывания kill-switch на ДРУГИХ инстансах (invalidate-on-write чистит только
// тот инстанс, что обслужил admin POST). Для soft launch (один инстанс, см. C-095)
// TTL избыточен — kill мгновенен через invalidate; 15с — потолок задержки при
// горизонтальном масштабе.
const CACHE_TTL_MS = 15_000;
let cache: { at: number; flags: Record<Feature, boolean> } | null = null;

/** Сбросить кэш флагов — зовётся из admin-роута сразу после успешного toggle. */
export function invalidateFeatureCache(): void {
  cache = null;
}

/**
 * Прочитать все флаги (с дефолтами для отсутствующих ключей). Fail-open к
 * дефолтам: если app_settings недоступна, verification/matching/interests/chat
 * продолжают работать (kill-switch — редкое ручное действие; недоступность БД не
 * должна ложно глушить продукт), а payments остаётся выключенным.
 */
export async function loadFeatureFlags(): Promise<Record<Feature, boolean>> {
  const now = Date.now();
  if (cache && now - cache.at < CACHE_TTL_MS) return cache.flags;

  const flags: Record<Feature, boolean> = { ...FEATURE_DEFAULTS };
  try {
    const rows = unwrapRows(
      await supabaseAdmin()
        .from("app_settings")
        .select("key, value")
        .in(
          "key",
          FEATURES.map(featureKey),
        ),
    ) as Array<{ key: string; value: unknown }>;
    const m = new Map(rows.map((r) => [r.key, r.value]));
    for (const f of FEATURES) {
      const v = m.get(featureKey(f));
      if (v === true || v === false) flags[f] = v;
    }
  } catch {
    // БД недоступна → дефолты (см. fail-open в докстринге).
  }

  cache = { at: now, flags };
  return flags;
}

/** Включена ли фича прямо сейчас. */
export async function isFeatureEnabled(f: Feature): Promise<boolean> {
  return (await loadFeatureFlags())[f];
}

/**
 * Гейт для API-роутов (interests / chat / verification). Возвращает готовый
 * 503-ответ, если фича выключена, иначе null (продолжаем). Код ошибки
 * `feature_disabled` + поле `feature` → мини-аппа рисует «временно недоступно»,
 * а не generic-краш.
 */
export async function assertFeatureEnabledForRequest(f: Feature): Promise<NextResponse | null> {
  if (await isFeatureEnabled(f)) return null;
  return NextResponse.json({ ok: false, error: "feature_disabled", feature: f }, { status: 503 });
}
