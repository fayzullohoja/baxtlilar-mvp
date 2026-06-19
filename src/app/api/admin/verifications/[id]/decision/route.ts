import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi, adminAudit, requireInQueueOrSuper } from "@/lib/admin/guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { tryTransition } from "@/lib/state-machine/transitions";
import { notifyUser } from "@/lib/telegram/notify";
import { trustedIp } from "@/lib/http/ip";
import type { OnboardingStep, VerificationStatus } from "@/lib/state-machine/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Action = "approve" | "reject" | "needs_changes";

const PUSH: Record<Action, string> = {
  approve:
    "✅ Поздравляем! Ваша личность подтверждена.\nОткройте Baxtlilar, чтобы заполнить анкету и начать знакомства.",
  reject:
    "К сожалению, мы не смогли подтвердить вашу личность.\nЕсли вы считаете это ошибкой, обратитесь в поддержку.",
  needs_changes:
    "Нужно переснять данные для проверки.\nОткройте Baxtlilar, чтобы загрузить их заново.",
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { session, res } = await requireAdminApi();
  if (res) return res;
  const { id } = await params;

  const body = (await req.json().catch(() => ({}))) as {
    action?: Action;
    reason?: string;
    target?: "passport" | "selfie" | "both";
  };
  const action = body.action;
  if (!action || !["approve", "reject", "needs_changes"].includes(action))
    return NextResponse.json({ ok: false, error: "bad_action" }, { status: 400 });
  if ((action === "reject" || action === "needs_changes") && !body.reason?.trim())
    return NextResponse.json({ ok: false, error: "reason_required" }, { status: 400 });

  // F-120: moderator должен действовать только над юзером в очереди.
  const scope = await requireInQueueOrSuper(session, id, "decision", req);
  if ("res" in scope) return scope.res;

  const { data: user } = await supabaseAdmin()
    .from("users")
    .select("id, telegram_id, verification_status, onboarding_step")
    .eq("id", id)
    .maybeSingle();
  if (!user) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  if (user.verification_status !== "pending_review")
    return NextResponse.json({ ok: false, error: "not_pending" }, { status: 409 });

  // BUG-4: нельзя одобрить без загруженных паспорта и селфи.
  // F-007: при одобрении ищем тот же sha256 паспорта/селфи у ЛЮБОГО другого
  // approved user_documents — это значит, тот же документ уже использован
  // на другом аккаунте (катфиш / ферма аккаунтов). Отказываем модератора.
  if (action === "approve") {
    const sb = supabaseAdmin();
    const { data: doc } = await sb
      .from("user_documents")
      .select("passport_path, selfie_path, passport_sha256, selfie_sha256")
      .eq("user_id", id)
      .maybeSingle();
    if (!doc?.passport_path || !doc?.selfie_path)
      return NextResponse.json({ ok: false, error: "documents_missing" }, { status: 409 });

    if (doc.passport_sha256) {
      const { data: dup } = await sb
        .from("user_documents")
        .select("user_id")
        .eq("status", "approved")
        .eq("passport_sha256", doc.passport_sha256)
        .neq("user_id", id)
        .limit(1)
        .maybeSingle();
      if (dup) {
        return NextResponse.json(
          { ok: false, error: "duplicate_identity", field: "passport", conflict_user_id: dup.user_id },
          { status: 409 },
        );
      }
    }
    if (doc.selfie_sha256) {
      const { data: dup } = await sb
        .from("user_documents")
        .select("user_id")
        .eq("status", "approved")
        .eq("selfie_sha256", doc.selfie_sha256)
        .neq("user_id", id)
        .limit(1)
        .maybeSingle();
      if (dup) {
        return NextResponse.json(
          { ok: false, error: "duplicate_identity", field: "selfie", conflict_user_id: dup.user_id },
          { status: 409 },
        );
      }
    }
  }

  let step: OnboardingStep;
  let vstatus: VerificationStatus;
  let docStatus: string;
  if (action === "approve") {
    step = "profile_basic";
    vstatus = "approved";
    docStatus = "approved";
  } else if (action === "reject") {
    step = "verification_rejected";
    vstatus = "rejected";
    docStatus = "rejected";
  } else {
    step = "needs_changes";
    vstatus = "needs_changes";
    docStatus = "needs_changes";
  }

  // BUG-3: сначала авторитетный переход (атомарно + аудит). При гонке — 409, ничего не меняем.
  const tr = await tryTransition(
    id,
    { verification_status: vstatus, onboarding_step: step },
    `moderation: ${action}${body.reason ? " — " + body.reason : ""}`,
    { kind: "admin", id: session.adminId },
  );
  if (!tr.ok) return NextResponse.json({ ok: false, error: tr.error }, { status: 409 });

  await supabaseAdmin()
    .from("user_documents")
    .update({
      status: docStatus,
      reject_reason: body.reason ?? null,
      reject_target: action === "needs_changes" ? body.target ?? "both" : null,
      moderated_by: session.adminId,
      moderated_at: new Date().toISOString(),
    })
    .eq("user_id", id);

  await adminAudit({
    adminId: session.adminId,
    action: `verification_${action}`,
    entity: "user",
    entityId: id,
    newValue: { verification_status: vstatus, onboarding_step: step },
    reason: body.reason,
    ip: trustedIp(req),
  });

  const pushText =
    action === "needs_changes" && body.reason
      ? `${PUSH.needs_changes}\n\nПричина: ${body.reason}`
      : PUSH[action];
  await notifyUser(user.telegram_id as number, pushText);

  return NextResponse.json({ ok: true });
}
