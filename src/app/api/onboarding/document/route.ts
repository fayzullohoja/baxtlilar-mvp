import { NextRequest, NextResponse } from "next/server";
import { loadUserForStep } from "@/lib/onboarding/guard-api";
import { transition } from "@/lib/state-machine/transitions";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { uploadDocumentImage } from "@/lib/uploads/storage";
import { ONBOARDING_PATHS } from "@/lib/state-machine/router";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Загрузка паспорта: upload в приватный бакет, doc_upload → selfie_upload. */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const { user, res } = await loadUserForStep("doc_upload");
  if (res) return res;

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File))
    return NextResponse.json({ ok: false, error: "no_file" }, { status: 400 });

  const up = await uploadDocumentImage(user.id, "passport", await file.arrayBuffer());
  if (!up.ok) return NextResponse.json({ ok: false, error: up.error }, { status: 400 });

  await supabaseAdmin()
    .from("user_documents")
    .upsert(
      { user_id: user.id, passport_path: up.path, status: "pending_review" },
      { onConflict: "user_id" },
    );

  await transition(
    user.id,
    { verification_status: "documents_uploaded", onboarding_step: "selfie_upload" },
    "passport uploaded",
    { kind: "user", id: user.id },
  );
  return NextResponse.json({ ok: true, next: ONBOARDING_PATHS.selfie_upload });
}
