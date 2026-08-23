import { NextRequest, NextResponse } from "next/server";
import { loadUserForVerificationRepair } from "@/lib/onboarding/guard-api";
import { tryTransition, type UserStatePatch } from "@/lib/state-machine/transitions";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { uploadDocumentImage } from "@/lib/uploads/storage";
import { isDocumentBlacklisted } from "@/lib/uploads/blacklist";
import { ONBOARDING_PATHS, nextScreenFor } from "@/lib/state-machine/router";
import { hasActiveBiometricConsent } from "@/lib/consent/biometric";
import { assertFeatureEnabledForRequest } from "@/lib/features/flags";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Повторная загрузка документов: грузим присланные файлы → снова в очередь.
 *
 * Единственная дорога назад после решения модератора для тех, кто уже ушёл из
 * до-анкетных шагов. Гейт - по verification_status, а не по onboarding_step:
 * после shadow-active человек в момент решения стоит на шаге анкеты (или уже
 * опубликовался и стал active), и вернуть ему верификационный шаг нельзя - это
 * ровно тот нелегальный прыжок, который ронял анкету в 409 на проде 12.08.2026.
 *
 * Принимаем два исхода модерации:
 *   needs_changes           - «поправьте фото»;
 *   rejected + technical    - «переснимите, не смогли проверить».
 * Блокирующий отказ (подделка/катфиш/несовершеннолетний) отсекается ниже.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  // C-033 kill switch, как в /document и /selfie. Раньше этот роут его не
  // слушался, и получалось так: верификацию выключили из-за перегруза очереди
  // или инцидента, два роута приёма документов встали, а третий - экран
  // «переделать документы» - продолжал принимать паспорта и селфи и растить
  // ту самую очередь. Рубильник обязан гасить подсистему целиком.
  const off = await assertFeatureEnabledForRequest("verification");
  if (off) return off;

  const { user, res } = await loadUserForVerificationRepair(["needs_changes", "rejected"]);
  if (res) return res;

  // ENFORCE согласия на биометрию ДО приёма файла - фактическая точка обработки
  // спец-категории ПД. Из трёх роутов приёма это был единственный без проверки:
  // /document и /selfie её делают, а сюда человек попадает как раз retry-путём,
  // ради которого enforcement в них и заводили. Fail-closed: при сбое чтения
  // согласий считаем, что согласия нет.
  if (!(await hasActiveBiometricConsent(user.id))) {
    return NextResponse.json(
      { ok: false, error: "biometric_consent_required", next: ONBOARDING_PATHS.verification_intro },
      { status: 403 },
    );
  }

  const sb = supabaseAdmin();

  // R1 verdict-guard, как в /api/onboarding/retry. Раньше эту дверь держал сам
  // гейт по шагу: blocking-отказ ставил шаг 'verification_rejected', а роут
  // требовал 'needs_changes'. Теперь гейт по статусу, и blocking сюда бы прошёл,
  // поэтому проверку категории надо делать ЯВНО и ДО любой мутации - иначе
  // человек с подозрением на подделку вернул бы себя в очередь через этот роут.
  const { data: doc } = await sb
    .from("user_documents")
    .select("reject_category")
    .eq("user_id", user.id)
    .maybeSingle();
  if (doc?.reject_category === "blocking") {
    // R9: лог попытки для security-визибильности (admin_id=null - system-side).
    await sb.from("admin_audit_log").insert({
      admin_id: null,
      action: "retry_blocked",
      entity: "user",
      entity_id: user.id,
      new_value: { reason: "blocking_reject", route: "fix" },
      reason: "user attempted re-upload after blocking reject",
      ip: null,
    });
    return NextResponse.json({ ok: false, error: "blocking_reject" }, { status: 403 });
  }

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ ok: false, error: "no_form" }, { status: 400 });

  const passport = form.get("passport");
  const selfie = form.get("selfie");
  const patch: {
    passport_path?: string;
    selfie_path?: string;
    passport_sha256?: string;
    selfie_sha256?: string;
  } = {};

  // Bug #16 (loop pass 3): SHA tombstone enforce on retry-after-needs_changes path.
  if (passport instanceof File) {
    const up = await uploadDocumentImage(user.id, "passport", await passport.arrayBuffer());
    if (!up.ok) return NextResponse.json({ ok: false, error: up.error }, { status: 400 });
    if (await isDocumentBlacklisted(up.sha256, "passport")) {
      return NextResponse.json({ ok: false, error: "document_blacklisted" }, { status: 400 });
    }
    patch.passport_path = up.path;
    patch.passport_sha256 = up.sha256;
  }
  if (selfie instanceof File) {
    const up = await uploadDocumentImage(user.id, "selfie", await selfie.arrayBuffer());
    if (!up.ok) return NextResponse.json({ ok: false, error: up.error }, { status: 400 });
    if (await isDocumentBlacklisted(up.sha256, "selfie")) {
      return NextResponse.json({ ok: false, error: "document_blacklisted" }, { status: 400 });
    }
    patch.selfie_path = up.path;
    patch.selfie_sha256 = up.sha256;
  }
  if (!patch.passport_path && !patch.selfie_path)
    return NextResponse.json({ ok: false, error: "no_file" }, { status: 400 });

  // Обновлённые файлы должны лечь в БД ДО возврата в модерацию.
  // reject_category сбрасываем (как /retry): это новая попытка верификации, и
  // устаревшая категория с прошлого круга не должна тянуться за человеком.
  const { error: saveErr } = await sb
    .from("user_documents")
    .update({
      ...patch,
      status: "pending_review",
      reject_reason: null,
      reject_target: null,
      reject_category: null,
    })
    .eq("user_id", user.id);
  if (saveErr) return NextResponse.json({ ok: false, error: "save_failed" }, { status: 500 });

  // Шаг двигаем ТОЛЬКО тому, кто стоит ровно на 'needs_changes' - единственное
  // ребро needs_changes → moderation_pending в ALLOWED_TRANSITIONS. Всем
  // остальным (человек в анкете, человек уже active) меняем один
  // verification_status: открытый кейс модератору всё равно заведёт триггер
  // users_ensure_verification_case на входе в pending_review, а шаг анкеты
  // обязан остаться нетронутым - иначе вернём ровно тот баг, который чиним.
  const onNeedsChangesStep =
    user.lifecycle_state === "onboarding" && user.onboarding_step === "needs_changes";
  const patchState: UserStatePatch = onNeedsChangesStep
    ? { verification_status: "pending_review", onboarding_step: "moderation_pending" }
    : { verification_status: "pending_review" };

  const tr = await tryTransition(user.id, patchState, "re-submitted documents for verification", {
    kind: "user",
    id: user.id,
  });
  if (!tr.ok) return NextResponse.json({ ok: false, error: tr.error }, { status: 409 });

  // Человеку в анкете / уже в приложении на /onboarding/pending делать нечего -
  // возвращаем его на его же экран (анкета там, где бросил, либо /main).
  // lifecycle_state и onboarding_step мы ему не меняли, поэтому nextScreenFor
  // по прочитанному до мутации user даёт верный ответ.
  return NextResponse.json({
    ok: true,
    next: onNeedsChangesStep ? ONBOARDING_PATHS.moderation_pending : nextScreenFor(user),
  });
}
