import { NextRequest, NextResponse } from "next/server";
import { loadUserForStep } from "@/lib/onboarding/guard-api";
import { tryTransition } from "@/lib/state-machine/transitions";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { uploadDocumentImage } from "@/lib/uploads/storage";
import { ONBOARDING_PATHS } from "@/lib/state-machine/router";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Повторная загрузка после needs_changes: грузим присланные файлы → снова на модерацию. */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const { user, res } = await loadUserForStep("needs_changes");
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

  if (passport instanceof File) {
    const up = await uploadDocumentImage(user.id, "passport", await passport.arrayBuffer());
    if (!up.ok) return NextResponse.json({ ok: false, error: up.error }, { status: 400 });
    patch.passport_path = up.path;
    patch.passport_sha256 = up.sha256;
  }
  if (selfie instanceof File) {
    const up = await uploadDocumentImage(user.id, "selfie", await selfie.arrayBuffer());
    if (!up.ok) return NextResponse.json({ ok: false, error: up.error }, { status: 400 });
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

  const tr = await tryTransition(
    user.id,
    { verification_status: "pending_review", onboarding_step: "moderation_pending" },
    "re-submitted after needs_changes",
    { kind: "user", id: user.id },
  );
  if (!tr.ok) return NextResponse.json({ ok: false, error: tr.error }, { status: 409 });
  return NextResponse.json({ ok: true, next: ONBOARDING_PATHS.moderation_pending });
}
