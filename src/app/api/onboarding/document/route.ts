import { NextRequest, NextResponse } from "next/server";
import { loadUserForStep } from "@/lib/onboarding/guard-api";
import { tryTransition } from "@/lib/state-machine/transitions";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { uploadDocumentImage } from "@/lib/uploads/storage";
import { isDocumentBlacklisted } from "@/lib/uploads/blacklist";
import { hasActiveBiometricConsent } from "@/lib/consent/biometric";
import { ONBOARDING_PATHS } from "@/lib/state-machine/router";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Загрузка документа: upload в приватный бакет, doc_upload → selfie_upload. */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const { user, res } = await loadUserForStep("doc_upload");
  if (res) return res;

  // ENFORCE согласия на биометрию ДО приёма файла — фактическая точка обработки
  // спец-категории ПД. Покрывает retry-пути (needs_changes/rejected → doc_upload),
  // которые минуют verification_intro. Fail-closed (совет advisor).
  if (!(await hasActiveBiometricConsent(user.id))) {
    return NextResponse.json(
      { ok: false, error: "biometric_consent_required", next: ONBOARDING_PATHS.verification_intro },
      { status: 403 },
    );
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File))
    return NextResponse.json({ ok: false, error: "no_file" }, { status: 400 });

  const up = await uploadDocumentImage(user.id, "passport", await file.arrayBuffer());
  if (!up.ok) return NextResponse.json({ ok: false, error: up.error }, { status: 400 });

  // Bug #16 (loop pass 3): SHA-tombstone от blocking-reject/erase_user раньше
  // не enforce'илась. Banned юзер мог re-uploadить тот же паспорт. Теперь —
  // 400 document_blacklisted ДО записи в DB.
  if (await isDocumentBlacklisted(up.sha256, "passport")) {
    return NextResponse.json(
      { ok: false, error: "document_blacklisted" },
      { status: 400 },
    );
  }

  // Путь к паспорту должен лечь в БД ДО продвижения шага (иначе селфи-шаг и
  // модерация без записанного документа). passport_sha256 — F-007 (дедуп
  // identity на admin-approve).
  const { error: saveErr } = await supabaseAdmin()
    .from("user_documents")
    .upsert(
      { user_id: user.id, passport_path: up.path, passport_sha256: up.sha256, status: "pending_review" },
      { onConflict: "user_id" },
    );
  if (saveErr) return NextResponse.json({ ok: false, error: "save_failed" }, { status: 500 });

  const tr = await tryTransition(
    user.id,
    { verification_status: "documents_uploaded", onboarding_step: "selfie_upload" },
    "passport uploaded",
    { kind: "user", id: user.id },
  );
  if (!tr.ok) return NextResponse.json({ ok: false, error: tr.error }, { status: 409 });
  return NextResponse.json({ ok: true, next: ONBOARDING_PATHS.selfie_upload });
}
