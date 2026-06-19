import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi, adminAudit } from "@/lib/admin/guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { trustedIp } from "@/lib/http/ip";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Реактивная модерация фото: approve/reject. Не влияет на онбординг-флоу пользователя. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { session, res } = await requireAdminApi();
  if (res) return res;
  const { id } = await params;
  const { action, reason } = (await req.json().catch(() => ({}))) as {
    action?: "approve" | "reject";
    reason?: string;
  };
  if (action !== "approve" && action !== "reject")
    return NextResponse.json({ ok: false, error: "bad_action" }, { status: 400 });

  const { data: photo } = await supabaseAdmin()
    .from("profile_photos")
    .select("id, user_id, status")
    .eq("id", id)
    .maybeSingle();
  if (!photo) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

  // F-120 (R2-#3 verdict): moderator может действовать ТОЛЬКО над фото в
  // активной модерации (status='under_review'/'uploaded'). approved/rejected
  // фото уже-обработанного юзера → 403 (раньше moderator мог "deplatform"
  // публичную фигуру, прокликав reject на всех её фото). Super-admin — без
  // ограничений (incident-response).
  if (session.role !== "superadmin") {
    if (photo.status !== "under_review" && photo.status !== "uploaded") {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }
  }

  // Сначала убеждаемся, что апдейт реально применился, и только потом пишем аудит —
  // иначе журнал зафиксирует «фантомное» решение (approve/reject), которого в БД нет.
  const { error } = await supabaseAdmin()
    .from("profile_photos")
    .update({
      status: action === "approve" ? "approved" : "rejected",
      reject_reason: action === "reject" ? (reason ?? null) : null,
    })
    .eq("id", id);
  if (error) return NextResponse.json({ ok: false, error: "failed" }, { status: 500 });

  await adminAudit({
    adminId: session.adminId,
    action: `photo_${action}`,
    entity: "profile_photo",
    entityId: id,
    reason,
    ip: trustedIp(req),
  });
  return NextResponse.json({ ok: true });
}
