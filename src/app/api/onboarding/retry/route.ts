import { NextResponse } from "next/server";
import { loadUserForStep } from "@/lib/onboarding/guard-api";
import { tryTransition } from "@/lib/state-machine/transitions";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ONBOARDING_PATHS } from "@/lib/state-machine/router";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** ONB-4: повторная попытка после отклонения — снова к загрузке паспорта. */
export async function POST(): Promise<NextResponse> {
  const { user, res } = await loadUserForStep("verification_rejected");
  if (res) return res;

  await supabaseAdmin()
    .from("user_documents")
    .update({ status: "pending_review", reject_reason: null, reject_target: null })
    .eq("user_id", user.id);

  const tr = await tryTransition(
    user.id,
    { verification_status: "phone_verified", onboarding_step: "doc_upload" },
    "user retries verification after rejection",
    { kind: "user", id: user.id },
  );
  if (!tr.ok) return NextResponse.json({ ok: false, error: tr.error }, { status: 409 });
  return NextResponse.json({ ok: true, next: ONBOARDING_PATHS.doc_upload });
}
