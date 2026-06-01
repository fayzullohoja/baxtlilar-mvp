import { NextResponse } from "next/server";
import { clearAdminSession } from "@/lib/admin/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(): Promise<NextResponse> {
  await clearAdminSession();
  return NextResponse.json({ ok: true });
}
