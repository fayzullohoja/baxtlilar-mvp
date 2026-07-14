import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi, adminAudit } from "@/lib/admin/guard";
import { can } from "@/lib/admin/permissions";
import { trustedIp } from "@/lib/http/ip";
import { pool } from "@/lib/db/pool";
import {
  LOCALES,
  type Locale,
  flatBase,
  validateOverrideText,
  invalidateVersionCache,
} from "@/lib/i18n/overrides";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Конструктор текстовок (Tier 1): правка строк локализации мини-аппа.
 *
 * PUT    { locale, key, value } — задать/обновить оверрайд одной строки.
 * DELETE ?locale=&key=          — вернуть строку к дефолту (удалить оверрайд).
 *
 * Безопасность:
 * - capability `i18n.edit` (super + moderator); blast-radius ГЛОБАЛЬНЫЙ (правка
 *   видна всем юзерам) → всё в admin_audit_log.
 * - WHITELIST: key обязан существовать в статичной базе как СТРОКОВЫЙ лист
 *   (flatBase) — иначе 400. Защита от произвольных/мусорных ключей.
 * - Плейсхолдеры {…} и rich-теги <…> оверрайда обязаны совпадать с оригиналом,
 *   иначе t()/t.rich бросит на рендере и уронит живой экран (write-time слой;
 *   render-time fail-safe — второй слой в applyOverride).
 */

function isLocale(v: unknown): v is Locale {
  return typeof v === "string" && (LOCALES as readonly string[]).includes(v);
}

export async function PUT(req: NextRequest) {
  const auth = await requireAdminApi();
  if (auth.res) return auth.res;
  const { session } = auth;
  if (!can(session.role, "i18n.edit")) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad_payload" }, { status: 400 });
  }
  const { locale, key, value } = (body ?? {}) as {
    locale?: unknown;
    key?: unknown;
    value?: unknown;
  };

  if (!isLocale(locale)) {
    return NextResponse.json({ ok: false, error: "bad_locale" }, { status: 400 });
  }
  if (typeof key !== "string" || key.length === 0) {
    return NextResponse.json({ ok: false, error: "bad_key" }, { status: 400 });
  }
  if (typeof value !== "string") {
    return NextResponse.json({ ok: false, error: "bad_value" }, { status: 400 });
  }

  const base = await flatBase(locale);
  // WHITELIST + proto-safety: Object.hasOwn отвергает __proto__/наследованные;
  // flatBase вообще не содержит proto-сегментов (flattenStrings их пропускает).
  if (!Object.hasOwn(base, key)) {
    return NextResponse.json(
      { ok: false, error: "unknown_key", detail: "ключ не найден среди редактируемых строк" },
      { status: 400 },
    );
  }
  const baseValue = base[key];

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return NextResponse.json(
      { ok: false, error: "empty_value", detail: "пустой текст недопустим; используйте «Сбросить»" },
      { status: 400 },
    );
  }
  const maxLen = Math.max(4000, baseValue.length * 2);
  if (trimmed.length > maxLen) {
    return NextResponse.json(
      { ok: false, error: "too_long", detail: `длиннее ${maxLen}` },
      { status: 400 },
    );
  }

  const check = validateOverrideText(baseValue, trimmed);
  if (!check.ok) {
    return NextResponse.json({ ok: false, error: "placeholder_mismatch", detail: check.error }, { status: 400 });
  }

  // Старое значение оверрайда (для аудита); null = раньше показывался дефолт.
  const prev = await pool().query<{ value: string }>(
    "select value from i18n_overrides where locale = $1 and key = $2",
    [locale, key],
  );
  const oldOverride = prev.rows[0]?.value ?? null;

  // No-op: значение совпадает с дефолтом → это сброс, а не оверрайд.
  if (trimmed === baseValue) {
    if (oldOverride !== null) {
      await pool().query("delete from i18n_overrides where locale = $1 and key = $2", [locale, key]);
      invalidateVersionCache();
      await audit(session.adminId, "i18n.revert", locale, key, oldOverride, null, trustedIp(req), "равно дефолту");
    }
    return NextResponse.json({ ok: true, reverted: true });
  }

  await pool().query(
    `insert into i18n_overrides (locale, key, value, updated_by, updated_at)
     values ($1, $2, $3, $4, now())
     on conflict (locale, key)
     do update set value = excluded.value, updated_by = excluded.updated_by, updated_at = now()`,
    [locale, key, trimmed, session.adminId],
  );
  invalidateVersionCache();
  await audit(session.adminId, "i18n.upsert", locale, key, oldOverride, trimmed, trustedIp(req));

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAdminApi();
  if (auth.res) return auth.res;
  const { session } = auth;
  if (!can(session.role, "i18n.edit")) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const locale = req.nextUrl.searchParams.get("locale");
  const key = req.nextUrl.searchParams.get("key");
  if (!isLocale(locale)) {
    return NextResponse.json({ ok: false, error: "bad_locale" }, { status: 400 });
  }
  if (!key) {
    return NextResponse.json({ ok: false, error: "bad_key" }, { status: 400 });
  }

  const del = await pool().query<{ value: string }>(
    "delete from i18n_overrides where locale = $1 and key = $2 returning value",
    [locale, key],
  );
  const existed = del.rows.length > 0;
  if (existed) {
    invalidateVersionCache();
    await audit(session.adminId, "i18n.revert", locale, key, del.rows[0].value, null, trustedIp(req));
  }
  return NextResponse.json({ ok: true, existed });
}

async function audit(
  adminId: string,
  action: string,
  locale: string,
  key: string,
  oldVal: string | null,
  newVal: string | null,
  ip: string | undefined,
  reason?: string,
): Promise<void> {
  // best-effort: сбой аудита не должен 500-ить успешную запись строки.
  try {
    await adminAudit({
      adminId,
      action,
      entity: "i18n_override",
      entityId: `${locale}:${key}`,
      oldValue: oldVal === null ? null : { value: oldVal },
      newValue: newVal === null ? null : { value: newVal },
      reason,
      ip,
    });
  } catch (e) {
    console.error("[i18n] audit failed:", e);
  }
}
