import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  let db = false;
  let dbError: string | undefined;
  try {
    const sb = supabaseAdmin();
    const { error } = await sb.from("users").select("id", { count: "exact", head: true }).limit(1);
    db = !error;
    if (error) dbError = error.message;
  } catch (e) {
    db = false;
    dbError = e instanceof Error ? e.message : String(e);
  }
  return NextResponse.json({
    ok: true,
    db,
    dbError,
    ts: new Date().toISOString(),
    commit:
      (process.env.RAILWAY_GIT_COMMIT_SHA ?? process.env.VERCEL_GIT_COMMIT_SHA)?.slice(0, 7) ??
      "local",
  });
}
