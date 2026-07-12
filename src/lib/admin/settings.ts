import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { unwrapRows } from "@/lib/db/unwrap";

// Волна 7 Фаза 3: фиксированный НАБОР админ-настроек (не arbitrary config). Ключи
// известны коду; app_settings хранит только значения. Дефолты — здесь.
export type AdminSettings = {
  bannerOn: boolean; // показать баннер-объявление всем админам
  bannerText: string;
  slaWarnHours: number; // порог «старейший кейс» подсвечивается на дашборде
};

export const SETTINGS_DEFAULTS: AdminSettings = {
  bannerOn: false,
  bannerText: "",
  slaWarnHours: 24,
};

// Ключи в app_settings ↔ поля AdminSettings.
const KEYS = ["banner_on", "banner_text", "sla_warn_hours"] as const;

export async function loadAdminSettings(): Promise<AdminSettings> {
  let rows: Array<{ key: string; value: unknown }> = [];
  try {
    rows = unwrapRows(
      await supabaseAdmin().from("app_settings").select("key, value").in("key", [...KEYS]),
    ) as Array<{ key: string; value: unknown }>;
  } catch {
    // Таблицы ещё нет / БД недоступна → дефолты (баннер не критичен).
    return SETTINGS_DEFAULTS;
  }
  const m = new Map(rows.map((r) => [r.key, r.value]));
  const banner_on = m.get("banner_on");
  const banner_text = m.get("banner_text");
  const sla = m.get("sla_warn_hours");
  return {
    bannerOn: banner_on === true,
    bannerText: typeof banner_text === "string" ? banner_text : SETTINGS_DEFAULTS.bannerText,
    slaWarnHours:
      typeof sla === "number" && sla > 0 && sla <= 720 ? sla : SETTINGS_DEFAULTS.slaWarnHours,
  };
}
