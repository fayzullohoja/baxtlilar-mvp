import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin/guard";
import { can } from "@/lib/admin/permissions";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// QZ-2 — освободить кейс обратно в пул. Гейт (владелец или суперадмин) — в RPC.
// draft_payload сохраняется, следующий модератор продолжит.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { session, res } = await requireAdminApi();
  if (res) return res;
  if (!can(session.role, "queue.work"))
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  const { id } = await params;

  const { data, error } = await supabaseAdmin().rpc("admin_release_case", {
    p_case_id: id,
    p_admin_id: session.adminId,
  });

  if (error) {
    return NextResponse.json(
      { ok: false, error: "rpc_error", detail: error.message },
      { status: 500 },
    );
  }
  const out = data as { ok: boolean; error?: string };
  if (!out.ok) {
    const status =
      out.error === "case_not_found"
        ? 404
        : out.error === "not_owner"
          ? 403
          : 400;
    return NextResponse.json(out, { status });
  }
  return NextResponse.json(out);
}
