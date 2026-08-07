import { NextRequest, NextResponse } from "next/server";
import { loadUserForStep } from "@/lib/onboarding/guard-api";
import { tryTransition } from "@/lib/state-machine/transitions";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { uploadDocumentImage } from "@/lib/uploads/storage";
import { isDocumentBlacklisted } from "@/lib/uploads/blacklist";
import { ONBOARDING_PATHS } from "@/lib/state-machine/router";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Повторная загрузка после needs_changes: грузим присланные файлы → снова на модерацию. */
export async function POST(req: NextRequest): Promise<NextResponse> {
  // Shadow-Active: решение needs_changes приходит и к уже активному юзеру
  // (lifecycle='active', onboarding_step='active') — его тоже пускаем на
  // перезагрузку документов, иначе он в перманентном тупике.
  const { user, res } = await loadUserForStep("needs_changes", {
    allowActiveWithVerification: "needs_changes",
  });
  if (res) return res;

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
  const { error: saveErr } = await supabaseAdmin()
    .from("user_documents")
    .update({ ...patch, status: "pending_review", reject_reason: null, reject_target: null })
    .eq("user_id", user.id);
  if (saveErr) return NextResponse.json({ ok: false, error: "save_failed" }, { status: 500 });

  // Shadow-active юзер УЖЕ прошёл онбординг (step='active') — ему меняем только
  // verification_status, иначе откатили бы его назад в онбординг-поток. Юзеру в
  // онбординге — как раньше: статус + шаг модерации.
  const isShadowActive = user.lifecycle_state === "active";
  const tr = await tryTransition(
    user.id,
    isShadowActive
      ? { verification_status: "pending_review" }
      : { verification_status: "pending_review", onboarding_step: "moderation_pending" },
    "re-submitted after needs_changes",
    { kind: "user", id: user.id },
  );
  if (!tr.ok) return NextResponse.json({ ok: false, error: tr.error }, { status: 409 });
  return NextResponse.json({
    ok: true,
    next: isShadowActive ? "/main" : ONBOARDING_PATHS.moderation_pending,
  });
}
