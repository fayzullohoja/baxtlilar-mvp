import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi, adminAudit, requireInQueueOrSuper } from "@/lib/admin/guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { tryTransition } from "@/lib/state-machine/transitions";
import { notifyUser } from "@/lib/telegram/notify";
import { trustedIp } from "@/lib/http/ip";
import { validateDecisionBody, type DecisionBody } from "@/lib/admin/decision-validate";
import type { OnboardingStep, VerificationStatus } from "@/lib/state-machine/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// MAJOR #2: для reject 'blocking' — отдельный push без призыва к retry.
// 'technical' → стандартный reject-текст с подсказкой переснять.
const PUSH_APPROVE =
  "✅ Ваш профиль успешно прошёл проверку.\nОткройте Baxtlilar, чтобы создать анкету. После публикации анкеты вам будут доступны рекомендации.";
const PUSH_REJECT_TECHNICAL =
  "Нужно переснять документы — модератор не смог проверить ваши фото.\nОткройте Baxtlilar, чтобы попробовать снова.";
const PUSH_REJECT_BLOCKING =
  "К сожалению, мы не смогли подтвердить вашу личность.\nЕсли вы считаете это ошибкой, обратитесь в поддержку.";
const PUSH_NEEDS_CHANGES =
  "Нужно переснять данные для проверки.\nОткройте Baxtlilar, чтобы загрузить их заново.";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { session, res } = await requireAdminApi();
  if (res) return res;
  const { id } = await params;

  const body = (await req.json().catch(() => ({}))) as DecisionBody;
  const validation = validateDecisionBody(body);
  if (!validation.ok)
    return NextResponse.json({ ok: false, error: validation.error }, { status: 400 });
  const action = validation.action;
  const rejectCategory = validation.rejectCategory; // 'technical' | 'blocking' | null

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
      // MAJOR #2: при approve/needs_changes — NULL (CHECK constraint), при reject — категория.
      reject_category: rejectCategory,
      moderated_by: session.adminId,
      moderated_at: new Date().toISOString(),
    })
    .eq("user_id", id);

  await adminAudit({
    adminId: session.adminId,
    action: `verification_${action}`,
    entity: "user",
    entityId: id,
    newValue: { verification_status: vstatus, onboarding_step: step, reject_category: rejectCategory },
    reason: body.reason,
    ip: trustedIp(req),
  });

  // MAJOR #2: для reject 'blocking' юзер видит мягкий support-текст, БЕЗ
  // призыва к retry. Для 'technical' — стандарт «переснимите».
  const pushText =
    action === "approve"
      ? PUSH_APPROVE
      : action === "needs_changes"
        ? body.reason
          ? `${PUSH_NEEDS_CHANGES}\n\nПричина: ${body.reason}`
          : PUSH_NEEDS_CHANGES
        : rejectCategory === "blocking"
          ? PUSH_REJECT_BLOCKING
          : PUSH_REJECT_TECHNICAL;
  await notifyUser(user.telegram_id as number, pushText);

  return NextResponse.json({ ok: true });
}
