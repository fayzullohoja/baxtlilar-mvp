import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi, adminAudit } from "@/lib/admin/guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { transition } from "@/lib/state-machine/transitions";
import { notifyUser } from "@/lib/telegram/notify";
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

  const { data: user } = await supabaseAdmin()
    .from("users")
    .select("id, telegram_id, verification_status, onboarding_step")
    .eq("id", id)
    .maybeSingle();
  if (!user) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  if (user.verification_status !== "pending_review")
    return NextResponse.json({ ok: false, error: "not_pending" }, { status: 409 });

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

  await transition(
    id,
    { verification_status: vstatus, onboarding_step: step },
    `moderation: ${action}${body.reason ? " — " + body.reason : ""}`,
    { kind: "admin", id: session.adminId },
  );

  await adminAudit({
    adminId: session.adminId,
    action: `verification_${action}`,
    entity: "user",
    entityId: id,
    newValue: { verification_status: vstatus, onboarding_step: step },
    reason: body.reason,
    ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
  });

  const pushText =
    action === "needs_changes" && body.reason
      ? `${PUSH.needs_changes}\n\nПричина: ${body.reason}`
      : PUSH[action];
  await notifyUser(user.telegram_id as number, pushText);

  return NextResponse.json({ ok: true });
}
