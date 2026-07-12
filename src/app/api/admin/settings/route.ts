import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin/guard";
import { can } from "@/lib/admin/permissions";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Волна 7 Фаза 3: сохранить админ-настройки. settings.edit (super). Набор ключей
// фиксирован; RPD ещё раз вайтлистит ключи. Значения валидируем тут.
export async function POST(req: NextRequest): Promise<NextResponse> {
  const { session, res } = await requireAdminApi();
  if (res) return res;
  if (!can(session.role, "settings.edit"))
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as {
    bannerOn?: boolean;
    bannerText?: string;
    slaWarnHours?: number;
  };
  const bannerText = (body.bannerText ?? "").slice(0, 500);
  const slaWarnHours = Number(body.slaWarnHours);
  if (!Number.isFinite(slaWarnHours) || slaWarnHours < 1 || slaWarnHours > 720)
    return NextResponse.json({ ok: false, error: "bad_sla" }, { status: 400 });

  const p_settings = {
    banner_on: body.bannerOn === true,
    banner_text: bannerText,
    sla_warn_hours: Math.round(slaWarnHours),
  };

  const { error } = await supabaseAdmin().rpc("set_app_settings", {
    p_admin: session.adminId,
    p_settings,
  });
  if (error) {
    console.error("[settings] RPC error:", error.message);
    return NextResponse.json({ ok: false, error: "internal" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
