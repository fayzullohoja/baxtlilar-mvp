import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi, adminAudit, requireInQueueOrSuper } from "@/lib/admin/guard";
import { can } from "@/lib/admin/permissions";
import { trustedIp } from "@/lib/http/ip";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { EDIT_FIELD_BY_KEY, type EditField } from "@/lib/admin/profile-edit-schema";
import { MARITAL_STATUS_NEEDS_REVIEW } from "@/lib/profile/options";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * PATCH /api/admin/users/[id]/profile — правка полей анкеты из карточки клиента.
 *
 * Безопасность:
 * - capability `profiles.edit` (super + moderator);
 * - moderator скоупится своей очередью (requireInQueueOrSuper) — как и остальной
 *   доступ к данным конкретного юзера; super — к любому;
 * - WHITELIST: пишутся ТОЛЬКО поля из PROFILE_EDIT_SECTIONS (EDIT_FIELD_BY_KEY).
 *   Паспортные gender/birth_date, looking_for_gender и пр. в реестре отсутствуют
 *   → неизвестное поле = 400 (защита от mass-assignment);
 * - каждое значение валидируется по типу/опциям/диапазону ПЕРЕД записью;
 * - hot-колонки пишутся напрямую, cold — мержатся в extended.<section> (не
 *   затирая соседние секции/ключи);
 * - правка marital_status на «чувствительный» статус снова поднимает F4-ревью;
 * - всё логируется в admin_audit_log (old→new).
 */

type ValidateResult = { ok: true; value: unknown } | { ok: false; error: string };

function isEmpty(v: unknown): boolean {
  return v === null || v === "" || (Array.isArray(v) && v.length === 0);
}

function validateValue(f: EditField, v: unknown): ValidateResult {
  // пустое значение = очистка поля (NOT NULL-колонки очищать нельзя → 400, не 500)
  if (isEmpty(v)) {
    if (f.required) return { ok: false, error: `${f.key}: обязательное поле, нельзя очистить` };
    return { ok: true, value: f.kind === "multiselect" ? [] : null };
  }

  switch (f.kind) {
    case "toggle":
      if (typeof v !== "boolean") return { ok: false, error: `${f.key}: ожидался boolean` };
      return { ok: true, value: v };
    case "number": {
      const n = typeof v === "number" ? v : Number(v);
      if (!Number.isFinite(n) || !Number.isInteger(n))
        return { ok: false, error: `${f.key}: ожидалось целое число` };
      if (f.min != null && n < f.min) return { ok: false, error: `${f.key}: меньше ${f.min}` };
      if (f.max != null && n > f.max) return { ok: false, error: `${f.key}: больше ${f.max}` };
      return { ok: true, value: n };
    }
    case "text":
    case "textarea": {
      if (typeof v !== "string") return { ok: false, error: `${f.key}: ожидалась строка` };
      const t = v.trim();
      if (f.maxLen != null && t.length > f.maxLen)
        return { ok: false, error: `${f.key}: длиннее ${f.maxLen}` };
      return { ok: true, value: t || null };
    }
    case "select": {
      if (typeof v !== "string" || !f.options?.some((o) => o.value === v))
        return { ok: false, error: `${f.key}: недопустимое значение` };
      return { ok: true, value: v };
    }
    case "multiselect": {
      if (!Array.isArray(v)) return { ok: false, error: `${f.key}: ожидался массив` };
      if (f.maxItems != null && v.length > f.maxItems)
        return { ok: false, error: `${f.key}: не более ${f.maxItems}` };
      const allowed = new Set(f.options?.map((o) => o.value));
      for (const x of v)
        if (typeof x !== "string" || !allowed.has(x))
          return { ok: false, error: `${f.key}: недопустимый элемент` };
      return { ok: true, value: [...new Set(v as string[])] };
    }
  }
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { session, res } = await requireAdminApi();
  if (res) return res;
  if (!can(session.role, "profiles.edit"))
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  const { id } = await ctx.params;

  // moderator-scope: только юзеры своей очереди; super — любой
  const scope = await requireInQueueOrSuper(session, id, "user_view", req);
  if ("res" in scope) return scope.res;

  const body = (await req.json().catch(() => ({}))) as { changes?: Record<string, unknown> };
  const changes = body.changes;
  if (!changes || typeof changes !== "object" || Array.isArray(changes) || !Object.keys(changes).length)
    return NextResponse.json({ ok: false, error: "no_changes" }, { status: 400 });

  // валидация + маршрутизация hot/cold
  const hot: Record<string, unknown> = {};
  const cold: Record<string, Record<string, unknown>> = {};
  const validated: Record<string, unknown> = {};
  for (const [key, rawVal] of Object.entries(changes)) {
    // Object.hasOwn — иначе inherited-ключи (__proto__/constructor/toString)
    // прошли бы `if (!f)` и уронили роут (post-auth 500).
    if (!Object.hasOwn(EDIT_FIELD_BY_KEY, key))
      return NextResponse.json({ ok: false, error: "unknown_field", detail: key }, { status: 400 });
    const f = EDIT_FIELD_BY_KEY[key];
    const vr = validateValue(f, rawVal);
    if (!vr.ok) return NextResponse.json({ ok: false, error: "validation", detail: vr.error }, { status: 400 });
    validated[key] = vr.value;
    if (f.cold) (cold[f.cold] ??= {})[key] = vr.value;
    else hot[key] = vr.value;
  }

  const sb = supabaseAdmin();
  const { data, error: loadErr } = await sb
    .from("user_profiles")
    .select("*")
    .eq("user_id", id)
    .maybeSingle();
  if (loadErr) return NextResponse.json({ ok: false, error: "db" }, { status: 500 });
  if (!data) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  const cur = data as Record<string, unknown>;
  const ext = (cur.extended as Record<string, Record<string, unknown>> | null) ?? {};

  // снимок старых значений для аудита
  const oldValues: Record<string, unknown> = {};
  for (const key of Object.keys(validated)) {
    const f = EDIT_FIELD_BY_KEY[key];
    oldValues[key] = f.cold ? (ext[f.cold]?.[key] ?? null) : (cur[key] ?? null);
  }

  // кросс-полевая проверка: min ≤ max для возраста/роста партнёра. Берём
  // эффективное значение (изменённое ИЛИ текущее из строки) — правка одного
  // конца тоже валидируется против другого. Иначе: age → тихая порча мэтчинга
  // (нет DB-CHECK на порядок), height → 500 от user_profiles_partner_height_chk.
  const eff = (k: string): unknown => (k in validated ? validated[k] : cur[k]);
  for (const [minK, maxK, label] of [
    ["partner_age_min", "partner_age_max", "возраст партнёра"],
    ["partner_height_min", "partner_height_max", "рост партнёра"],
  ] as const) {
    const lo = eff(minK);
    const hi = eff(maxK);
    if (typeof lo === "number" && typeof hi === "number" && lo > hi)
      return NextResponse.json(
        { ok: false, error: "validation", detail: `${label}: «от» больше «до»` },
        { status: 400 },
      );
  }

  // мерж extended — сохраняем соседние секции и ключи
  const patch: Record<string, unknown> = { ...hot, updated_at: new Date().toISOString() };
  if (Object.keys(cold).length) {
    const newExt = { ...ext };
    for (const [section, kv] of Object.entries(cold))
      newExt[section] = { ...(ext[section] ?? {}), ...kv };
    patch.extended = newExt;
  }
  // F4: правка семейного статуса → пересчёт needs_marital_review
  if ("marital_status" in hot) {
    patch.needs_marital_review = (MARITAL_STATUS_NEEDS_REVIEW as readonly string[]).includes(
      String(hot.marital_status),
    );
  }

  const { error: upErr } = await sb.from("user_profiles").update(patch).eq("user_id", id);
  if (upErr)
    return NextResponse.json({ ok: false, error: "save_failed", detail: upErr.message }, { status: 500 });

  // best-effort: сбой аудита не должен 500-ить уже прошедшую запись профиля
  try {
    await adminAudit({
      adminId: session.adminId,
      action: "profile_edited",
      entity: "profile",
      entityId: id,
      oldValue: oldValues,
      newValue: validated,
      ip: trustedIp(req),
    });
  } catch (e) {
    console.error("[profile-edit] audit failed:", e instanceof Error ? e.message : e);
  }

  return NextResponse.json({ ok: true, changed: Object.keys(validated) });
}
