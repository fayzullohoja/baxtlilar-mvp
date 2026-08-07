import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi, adminAudit } from "@/lib/admin/guard";
import { can } from "@/lib/admin/permissions";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { trustedIp } from "@/lib/http/ip";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// F-119 blocking-reject (fake/minor/catfish) для студии кейсов. Атомарный RPC
// admin_blocking_reject_case переиспользует проверенный admin_blocking_reject
// (телефон-тумбстон 10 лет + sha-блэклист, БЕЗ H-1) и закрывает кейс.
const PHONE_TOMBSTONE_DAYS = 365 * 10;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { session, res } = await requireAdminApi();
  if (res) return res;
  if (!can(session.role, "queue.work"))
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  const { id } = await params;

  const body = (await req.json().catch(() => ({}))) as {
    reason?: string;
    category?: "fake" | "minor" | "catfish";
  };
  const reason = (body.reason ?? "").trim();
  const category = body.category;
  if (reason.length < 3) {
    return NextResponse.json({ ok: false, error: "reason_required" }, { status: 400 });
  }
  if (category !== "fake" && category !== "minor" && category !== "catfish") {
    return NextResponse.json({ ok: false, error: "bad_category" }, { status: 400 });
  }

  const until = new Date(
    Date.now() + PHONE_TOMBSTONE_DAYS * 24 * 3600 * 1000,
  ).toISOString();

  const { data, error } = await supabaseAdmin().rpc("admin_blocking_reject_case", {
    p_case_id: id,
    p_admin_id: session.adminId,
    p_reason: reason,
    p_category: category,
    p_phone_until_at: until,
  });
  if (error) {
    return NextResponse.json(
      { ok: false, error: "rpc_error", detail: error.message },
      { status: 500 },
    );
  }
  const out = data as {
    ok: boolean;
    error?: string;
    user_id?: string;
    phone_tombstone?: boolean;
  };
  if (!out.ok) {
    const status =
      out.error === "case_not_found"
        ? 404
        : out.error === "not_claimed_by_you"
          ? 403
          : out.error === "conflict" ||
              out.error === "case_closed" ||
              out.error === "not_pending"
            ? 409
            : 400;
    return NextResponse.json(out, { status });
  }

  await adminAudit({
    adminId: session.adminId,
    action: "verification_blocking_reject",
    entity: "user",
    entityId: out.user_id,
    newValue: { category, phone_tombstone: out.phone_tombstone },
    reason,
    ip: trustedIp(req),
  });
  return NextResponse.json({ ok: true });
}
