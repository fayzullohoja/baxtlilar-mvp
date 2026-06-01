import { NextRequest, NextResponse } from "next/server";
import { loadActiveUserApi } from "@/lib/auth/active-guard";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Пропустить кандидата — пишем match_views (исключение из ленты). */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const { user, res } = await loadActiveUserApi();
  if (res) return res;
  const { target_id } = (await req.json().catch(() => ({}))) as { target_id?: string };
  if (!target_id || target_id === user.id)
    return NextResponse.json({ ok: false, error: "bad_target" }, { status: 400 });

  await supabaseAdmin()
    .from("match_views")
    .upsert({ viewer_id: user.id, target_id }, { onConflict: "viewer_id,target_id" });
  return NextResponse.json({ ok: true });
}
