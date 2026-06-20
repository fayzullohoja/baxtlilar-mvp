import { NextResponse } from "next/server";
import { loadUserForStep } from "@/lib/onboarding/guard-api";
import { tryTransition } from "@/lib/state-machine/transitions";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ONBOARDING_PATHS } from "@/lib/state-machine/router";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Повторная попытка после отклонения. MAJOR #2: серверный guard на
 * reject_category='blocking' — юзеру с подозрением на подделку / катфиш /
 * несовершеннолетнего нельзя ретраиться через UI. Запись попытки в audit-лог
 * для security-визибильности (R9 из adversarial: 3+ blocking-retry на один
 * аккаунт — сигнал для cron-алёрта в будущем).
 *
 * NULL reject_category (legacy строки, до миграции 20260620200000) → allow
 * как technical — backwards-compat.
 */
export async function POST(): Promise<NextResponse> {
  const { user, res } = await loadUserForStep("verification_rejected");
  if (res) return res;

  const sb = supabaseAdmin();

  // R1 verdict-guard: серверная проверка категории ДО любой мутации.
  const { data: doc } = await sb
    .from("user_documents")
    .select("reject_category")
    .eq("user_id", user.id)
    .maybeSingle();
  if (doc?.reject_category === "blocking") {
    // R9: лог попытки в admin_audit_log с admin_id=null (это system-side trigger).
    await sb.from("admin_audit_log").insert({
      admin_id: null,
      action: "retry_blocked",
      entity: "user",
      entity_id: user.id,
      new_value: { reason: "blocking_reject" },
      reason: "user attempted retry after blocking reject",
      ip: null,
    });
    return NextResponse.json({ ok: false, error: "blocking_reject" }, { status: 403 });
  }

  const { error: saveErr } = await sb
    .from("user_documents")
    .update({
      status: "pending_review",
      reject_reason: null,
      reject_target: null,
      reject_category: null, // сбрасываем при retry (новая verif-попытка)
    })
    .eq("user_id", user.id);
  if (saveErr) return NextResponse.json({ ok: false, error: "save_failed" }, { status: 500 });

  const tr = await tryTransition(
    user.id,
    { verification_status: "phone_verified", onboarding_step: "doc_upload" },
    "user retries verification after rejection",
    { kind: "user", id: user.id },
  );
  if (!tr.ok) return NextResponse.json({ ok: false, error: tr.error }, { status: 409 });
  return NextResponse.json({ ok: true, next: ONBOARDING_PATHS.doc_upload });
}
