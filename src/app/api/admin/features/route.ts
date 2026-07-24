import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi, adminAudit } from "@/lib/admin/guard";
import { can } from "@/lib/admin/permissions";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  FEATURES,
  loadFeatureFlags,
  invalidateFeatureCache,
  type Feature,
} from "@/lib/features/flags";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isFeature(x: unknown): x is Feature {
  return typeof x === "string" && (FEATURES as readonly string[]).includes(x);
}

// C-033: текущее состояние kill-switch'ей. settings.edit (super).
export async function GET(): Promise<NextResponse> {
  const { session, res } = await requireAdminApi();
  if (res) return res;
  if (!can(session.role, "settings.edit"))
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  return NextResponse.json({ ok: true, flags: await loadFeatureFlags() });
}

// C-033: включить/выключить одну фичу без деплоя. settings.edit (super).
// Атомарно через RPC (вайтлист имён), логируется в admin_audit_log, кэш флагов
// сбрасывается сразу → эффект на этом инстансе мгновенный.
export async function POST(req: NextRequest): Promise<NextResponse> {
  const { session, res } = await requireAdminApi();
  if (res) return res;
  if (!can(session.role, "settings.edit"))
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as { feature?: unknown; enabled?: unknown };
  if (!isFeature(body.feature))
    return NextResponse.json({ ok: false, error: "bad_feature" }, { status: 400 });
  if (typeof body.enabled !== "boolean")
    return NextResponse.json({ ok: false, error: "bad_enabled" }, { status: 400 });

  const feature = body.feature;
  const enabled = body.enabled;

  const { error } = await supabaseAdmin().rpc("set_feature_flag", {
    p_admin: session.adminId,
    p_feature: feature,
    p_enabled: enabled,
  });
  if (error) {
    console.error("[features] RPC error:", error.message);
    return NextResponse.json({ ok: false, error: "internal" }, { status: 500 });
  }

  // Инвариант 7: чувствительное действие — в аудит.
  await adminAudit({
    adminId: session.adminId,
    action: enabled ? "feature_enable" : "feature_disable",
    entity: "feature_flag",
    entityId: feature,
    newValue: { enabled },
  });

  invalidateFeatureCache();
  return NextResponse.json({ ok: true, flags: await loadFeatureFlags() });
}
