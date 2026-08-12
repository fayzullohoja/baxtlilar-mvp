import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi, adminAudit } from "@/lib/admin/guard";
import { can } from "@/lib/admin/permissions";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { trustedIp } from "@/lib/http/ip";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * F-final-1 (C9): super-admin может откатить blocking-reject.
 *
 * Возвращает юзера в pending_review (заявка снова в админ-очереди),
 * чистит phone_blacklist row + все document_sha_blacklist rows этого юзера.
 * Атомарно через admin_unblock_verification RPC.
 *
 * Цель: misclick / пересмотр решения. Не для regular unban (blocked → active);
 * для этого есть отдельный /unban endpoint.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { session, res } = await requireAdminApi();
  if (res) return res;
  if (!can(session.role, "users.sanction"))
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  const { id } = await params;

  const sb = supabaseAdmin();
  const { data: user } = await sb
    .from("users")
    .select("id, updated_at, verification_status, lifecycle_state")
    .eq("id", id)
    .maybeSingle();
  if (!user) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

  // H10 verdict-fix: RPC чистит только по linked_user_id (legacy fallback убран).
  const { data, error } = await sb.rpc("admin_unblock_verification", {
    p_user_id: id,
    p_admin_id: session.adminId,
    p_expected_updated_at: user.updated_at,
  });
  if (error) {
    console.error("[unblock-verification] RPC error:", error.message);
    return NextResponse.json({ ok: false, error: "internal" }, { status: 500 });
  }
  const r = data as {
    ok: boolean;
    error?: string;
    phone_tombstone_cleared?: number;
    sha_tombstones_cleared?: number;
  };
  if (!r.ok) {
    // banned_lifecycle - новый код из миграции 20260812140000: отказ ТОЛЬКО для
    // blocked/pending_ban/deleted. wrong_lifecycle оставлен рядом намеренно: он
    // придёт, если БД ещё не накатила эту миграцию, и без него старый ответ
    // превратился бы в 500 «внутренняя ошибка» вместо внятного 409.
    const status =
      r.error === "not_found"
        ? 404
        : r.error === "conflict"
          ? 409
          : r.error === "not_rejected" ||
              r.error === "banned_lifecycle" ||
              r.error === "wrong_lifecycle" ||
              r.error === "not_blocking" ||
              r.error === "no_documents"
            ? 409
            : 500;
    return NextResponse.json({ ok: false, error: r.error }, { status });
  }

  await adminAudit({
    adminId: session.adminId,
    action: "verification_blocking_revoked",
    entity: "user",
    entityId: id,
    newValue: {
      phone_tombstone_cleared: r.phone_tombstone_cleared,
      sha_tombstones_cleared: r.sha_tombstones_cleared,
    },
    ip: trustedIp(req),
  });
  return NextResponse.json({
    ok: true,
    phone_tombstone_cleared: r.phone_tombstone_cleared,
    sha_tombstones_cleared: r.sha_tombstones_cleared,
  });
}
