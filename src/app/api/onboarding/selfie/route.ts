import { NextRequest, NextResponse } from "next/server";
import { loadUserForStep } from "@/lib/onboarding/guard-api";
import { tryTransition } from "@/lib/state-machine/transitions";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { uploadDocumentImage } from "@/lib/uploads/storage";
import { ONBOARDING_PATHS } from "@/lib/state-machine/router";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Загрузка селфи (liveness): upload → заявка уходит в очередь модерации.
 * verification_status → pending_review, selfie_upload → moderation_pending.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const { user, res } = await loadUserForStep("selfie_upload");
  if (res) return res;

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File))
    return NextResponse.json({ ok: false, error: "no_file" }, { status: 400 });

  const up = await uploadDocumentImage(user.id, "selfie", await file.arrayBuffer());
  if (!up.ok) return NextResponse.json({ ok: false, error: up.error }, { status: 400 });

  await supabaseAdmin()
    .from("user_documents")
    .upsert(
      { user_id: user.id, selfie_path: up.path, status: "pending_review" },
      { onConflict: "user_id" },
    );

  const tr = await tryTransition(
    user.id,
    { verification_status: "pending_review", onboarding_step: "moderation_pending" },
    "selfie uploaded, submitted to moderation",
    { kind: "user", id: user.id },
  );
  if (!tr.ok) return NextResponse.json({ ok: false, error: tr.error }, { status: 409 });
  return NextResponse.json({ ok: true, next: ONBOARDING_PATHS.moderation_pending });
}
