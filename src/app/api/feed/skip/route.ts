import { NextRequest, NextResponse } from "next/server";
import { loadActiveUserApi } from "@/lib/auth/active-guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { deriveRole, hasPermission } from "@/lib/v2/permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Пропустить кандидата — пишем match_views (исключение из ленты).
 *
 * V2 (2026-06-25): permission gate fail-closed. Shadow user не видит ленту,
 * значит не может вызывать skip. Защита от прямых POST до того как
 * фронт обновится.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const { user, res } = await loadActiveUserApi();
  if (res) return res;

  const role = deriveRole(user.lifecycle_state, user.verification_status);
  if (!hasPermission(role, "view_feed")) {
    return NextResponse.json({ ok: false, error: "no_feed_access" }, { status: 403 });
  }

  const { target_id } = (await req.json().catch(() => ({}))) as { target_id?: string };
  if (!target_id || target_id === user.id)
    return NextResponse.json({ ok: false, error: "bad_target" }, { status: 400 });

  await supabaseAdmin()
    .from("match_views")
    .upsert({ viewer_id: user.id, target_id }, { onConflict: "viewer_id,target_id" });
  return NextResponse.json({ ok: true });
}
