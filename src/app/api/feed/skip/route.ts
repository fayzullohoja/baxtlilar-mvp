import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requirePermissionForRequest } from "@/lib/v2/with-permission";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Пропустить кандидата — пишем match_views (исключение из ленты).
 *
 * V2 Phase A: gate через withPermission. Shadow user не видит ленту,
 * значит не может вызывать skip.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const gate = await requirePermissionForRequest("view_feed");
  if ("response" in gate) return gate.response;
  const { user } = gate;

  const { target_id } = (await req.json().catch(() => ({}))) as { target_id?: string };
  if (!target_id || target_id === user.id)
    return NextResponse.json({ ok: false, error: "bad_target" }, { status: 400 });

  await supabaseAdmin()
    .from("match_views")
    .upsert({ viewer_id: user.id, target_id }, { onConflict: "viewer_id,target_id" });
  return NextResponse.json({ ok: true });
}
