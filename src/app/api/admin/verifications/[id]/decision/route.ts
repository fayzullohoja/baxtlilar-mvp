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

// R2 verdict-followup: blocking-reject = тяжёлый сигнал. Phone-tombstone на
// 10 лет в phone_blacklist эквивалентен «фактически бессрочно» — закрывает
// re-register с тем же номером через новый TG-аккаунт.
const PHONE_BLOCKING_TOMBSTONE_DAYS = 365 * 10;

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
    .select("id, telegram_id, phone_number, verification_status, onboarding_step")
    .eq("id", id)
    .maybeSingle();
  if (!user) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  if (user.verification_status !== "pending_review")
    return NextResponse.json({ ok: false, error: "not_pending" }, { status: 409 });

  // BUG-4: нельзя одобрить без загруженных паспорта и селфи.
  // F-007 + R3 + verdict C3/C5: при approve проверяем sha-дубли в 3 источниках:
  //  - user_documents approved (F-007 baseline)
  //  - user_documents rejected+blocking (R3 — catfish с новым TG/телефоном)
  //  - document_sha_blacklist (C5 — survives erase_user/retry)
  // sha NULL → 409 sha_missing (C3): legacy pre-migration документы — модератор
  // должен сначала перезалить, иначе F-007 пропускает дубли.
  if (action === "approve") {
    const sb = supabaseAdmin();
    const { data: doc } = await sb
      .from("user_documents")
      .select("passport_path, selfie_path, passport_sha256, selfie_sha256")
      .eq("user_id", id)
      .maybeSingle();
    if (!doc?.passport_path || !doc?.selfie_path)
      return NextResponse.json({ ok: false, error: "documents_missing" }, { status: 409 });

    // C3: sha NULL → reject. До MAJOR #2 миграции (20260619200000) sha-колонки
    // не существовали → legacy rows с NULL. Approving такие даёт false-negative
    // sha-dedup. Только модератор может разрешить, и только перезалив.
    if (!doc.passport_sha256 || !doc.selfie_sha256) {
      return NextResponse.json(
        { ok: false, error: "sha_missing", field: !doc.passport_sha256 ? "passport" : "selfie" },
        { status: 409 },
      );
    }

    // F-007 (approved-dup) + R3 (blocking-dup) + C5 (sha_blacklist)
    async function checkDup(field: "passport" | "selfie", sha: string) {
      const approvedDup = await sb
        .from("user_documents")
        .select("user_id")
        .eq("status", "approved")
        .eq(`${field}_sha256`, sha)
        .neq("user_id", id)
        .limit(1)
        .maybeSingle();
      if (approvedDup.data) return { scope: "approved" as const, conflict: approvedDup.data.user_id };

      const blockedDup = await sb
        .from("user_documents")
        .select("user_id")
        .eq("status", "rejected")
        .eq("reject_category", "blocking")
        .eq(`${field}_sha256`, sha)
        .neq("user_id", id)
        .limit(1)
        .maybeSingle();
      if (blockedDup.data) return { scope: "blocking" as const, conflict: blockedDup.data.user_id };

      // C5: append-only sha_blacklist — переживает erase_user / retry.
      const tomb = await sb
        .from("document_sha_blacklist")
        .select("source_user_id")
        .eq("kind", field)
        .eq("sha256", sha)
        .limit(1)
        .maybeSingle();
      if (tomb.data) return { scope: "tombstone" as const, conflict: tomb.data.source_user_id };

      return null;
    }

    const passportDup = await checkDup("passport", doc.passport_sha256);
    if (passportDup) {
      return NextResponse.json(
        { ok: false, error: "duplicate_identity", field: "passport", ...passportDup },
        { status: 409 },
      );
    }
    const selfieDup = await checkDup("selfie", doc.selfie_sha256);
    if (selfieDup) {
      return NextResponse.json(
        { ok: false, error: "duplicate_identity", field: "selfie", ...selfieDup },
        { status: 409 },
      );
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
  // C1/C2 verdict-fix: blocking-reject — атомарный RPC. H9 verdict-fix: RPC
  // теперь сам читает phone_number / sha256 ИЗ БД (не доверяет route'у).
  // Compromised route больше не может скрыть tombstone передавая null.
  if (action === "reject" && rejectCategory === "blocking") {
    const sb = supabaseAdmin();
    const until = new Date(
      Date.now() + PHONE_BLOCKING_TOMBSTONE_DAYS * 24 * 3600 * 1000,
    ).toISOString();
    const { data: cur } = await sb.from("users").select("updated_at").eq("id", id).single();
    const { data, error } = await sb.rpc("admin_blocking_reject", {
      p_user_id: id,
      p_admin_id: session.adminId,
      p_reason: body.reason!,
      p_phone_until_at: until,
      p_expected_updated_at: cur?.updated_at,
    });
    if (error) {
      console.error("[decision] admin_blocking_reject RPC failed:", error.message);
      return NextResponse.json({ ok: false, error: "internal" }, { status: 500 });
    }
    const r = data as { ok: boolean; error?: string; phone_tombstone_written?: boolean };
    if (!r.ok) return NextResponse.json({ ok: false, error: r.error }, { status: 409 });

    await adminAudit({
      adminId: session.adminId,
      action: "verification_reject",
      entity: "user",
      entityId: id,
      newValue: {
        verification_status: "rejected",
        onboarding_step: "verification_rejected",
        reject_category: "blocking",
      },
      reason: body.reason,
      ip: trustedIp(req),
    });
    if (r.phone_tombstone_written) {
      await adminAudit({
        adminId: session.adminId,
        action: "phone_tombstone",
        entity: "user",
        entityId: id,
        newValue: { until_at: until, reason: "verification_blocking_reject" },
        ip: trustedIp(req),
      });
    } else {
      // C8 verdict-fix: NULL phone — silent skip раньше. Теперь audit-trail
      // аномалии (модератор уверен что номер забанен, но tombstone отсутствует).
      await adminAudit({
        adminId: session.adminId,
        action: "phone_tombstone_skipped",
        entity: "user",
        entityId: id,
        newValue: { reason: "no_phone_on_user" },
        ip: trustedIp(req),
      });
    }

    // push сразу после успешного RPC (см. ниже общий блок)
  } else {
    // approve / reject(technical) / needs_changes — старая логика (не атомар-
    // ная, но безопасная: эти ветки не пишут в защитные tombstone-таблицы).
    const tr = await tryTransition(
      id,
      { verification_status: vstatus, onboarding_step: step },
      `moderation: ${action}${body.reason ? " — " + body.reason : ""}`,
      { kind: "admin", id: session.adminId },
    );
    if (!tr.ok) return NextResponse.json({ ok: false, error: tr.error }, { status: 409 });

    // C4 verdict-fix: partial UNIQUE на approved-sha может бросить 23505 при
    // одновременном approve дублей двумя модераторами. Ловим → 409.
    const { error: docErr } = await supabaseAdmin()
      .from("user_documents")
      .update({
        status: docStatus,
        reject_reason: body.reason ?? null,
        reject_target: action === "needs_changes" ? body.target ?? "both" : null,
        reject_category: rejectCategory,
        moderated_by: session.adminId,
        moderated_at: new Date().toISOString(),
      })
      .eq("user_id", id);
    if (docErr) {
      const code = (docErr as { code?: string }).code;
      if (code === "23505") {
        return NextResponse.json(
          { ok: false, error: "duplicate_identity_race" },
          { status: 409 },
        );
      }
      console.error("[decision] user_documents update failed:", docErr.message);
      return NextResponse.json({ ok: false, error: "internal" }, { status: 500 });
    }

    await adminAudit({
      adminId: session.adminId,
      action: `verification_${action}`,
      entity: "user",
      entityId: id,
      newValue: { verification_status: vstatus, onboarding_step: step, reject_category: rejectCategory },
      reason: body.reason,
      ip: trustedIp(req),
    });
  }

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
