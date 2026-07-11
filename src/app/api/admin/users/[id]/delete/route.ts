import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin/guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { BUCKET_DOCUMENTS, BUCKET_PHOTOS } from "@/lib/uploads/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// DZ-2: hard-delete аккаунта (необратимо). Superadmin + typed-confirm 'DELETE'.
// RPC сносит всю БД (FK cascade, обходя append-only case_events); здесь —
// best-effort очистка файлов на volume.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { session, res } = await requireAdminApi();
  if (res) return res;
  if (session.role !== "superadmin")
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  const { id } = await params;

  const body = (await req.json().catch(() => ({}))) as { confirm?: string; reason?: string };
  if (body.confirm !== "DELETE")
    return NextResponse.json({ ok: false, error: "confirm_required" }, { status: 400 });
  const reason = (body.reason ?? "").trim();
  if (reason.length < 3)
    return NextResponse.json({ ok: false, error: "reason_required" }, { status: 400 });

  const sb = supabaseAdmin();
  const { data, error } = await sb.rpc("admin_hard_delete_user", {
    p_user_id: id,
    p_admin_id: session.adminId,
    p_reason: reason,
  });
  if (error) {
    console.error("[hard-delete] RPC error:", error.message);
    return NextResponse.json({ ok: false, error: "internal" }, { status: 500 });
  }
  const r = data as { ok: boolean; error?: string; storage_paths?: string[] };
  if (!r.ok)
    return NextResponse.json(r, { status: r.error === "not_found" ? 404 : 400 });

  // best-effort: пробуем удалить файлы из обоих приватных бакетов (неверный
  // бакет — no-op/ошибка, глушим). БД уже удалена — файлы иначе осиротеют.
  const paths = r.storage_paths ?? [];
  if (paths.length) {
    for (const bucket of [BUCKET_PHOTOS, BUCKET_DOCUMENTS]) {
      try {
        await sb.storage.from(bucket).remove(paths);
      } catch (e) {
        console.error(`[hard-delete] storage cleanup (${bucket}) failed:`, e);
      }
    }
  }
  return NextResponse.json({ ok: true });
}
