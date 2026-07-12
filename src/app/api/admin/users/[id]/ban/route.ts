import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi, dispatchBanAction } from "@/lib/admin/guard";
import { can } from "@/lib/admin/permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// F-119: two-person rule. Permanent ban требует двухшагового подтверждения
// двумя разными super-admin'ами в течение 24ч. Поддерживаемые actions:
//   - propose: первый админ предлагает бан (юзер переходит в lifecycle_state=
//     'pending_ban'). 24ч таймер до auto-cancel.
//   - confirm: ВТОРОЙ (другой) админ подтверждает; юзер становится 'blocked'.
//     SQL проверяет admin_id != pending_ban_by_admin_id.
//   - cancel: любой super-admin (включая proposer) отменяет; юзер возвращается
//     в active/onboarding.
//
// action отсутствует → 400 action_required. Legacy-клиенты сломаются явно
// (лучше, чем продолжить молча банить одним кликом).
//
// CSRF: гард на уровне middleware (Origin allowlist, F-010).
// trustedIp: F-011 (Railway envoy header).
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { session, res } = await requireAdminApi();
  if (res) return res;
  // RBAC (Волна 7): бан — деструктивная санкция, требует users.sanction (super).
  // Раньше роут был any-admin (полагались на super-only UI) → латентная дыра:
  // модератор мог POST'ить напрямую. Two-person rule предполагает super-admin'ов.
  if (!can(session.role, "users.sanction"))
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  const { id } = await params;

  const body = (await req.json().catch(() => ({}))) as {
    action?: "propose" | "confirm" | "cancel";
    reason?: string;
    confirm_reason_override?: string;
  };

  const action = body.action;
  if (!action) {
    return NextResponse.json(
      { ok: false, error: "action_required", hint: "specify action: propose|confirm|cancel" },
      { status: 400 },
    );
  }
  if (action !== "propose" && action !== "confirm" && action !== "cancel") {
    return NextResponse.json({ ok: false, error: "invalid_action" }, { status: 400 });
  }
  return dispatchBanAction(session, id, action, body, req);
}
