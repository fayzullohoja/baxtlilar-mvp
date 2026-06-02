import { NextResponse } from "next/server";
import { loadUserForStep } from "@/lib/onboarding/guard-api";
import { tryTransition } from "@/lib/state-machine/transitions";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ONBOARDING_PATHS } from "@/lib/state-machine/router";
import { LEGAL_VERSION } from "@/content/legal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// версия согласий = версия опубликованных юр-документов (ToS/Политика/оферта)
const CONSENT_VERSION = LEGAL_VERSION;
const CONSENT_TYPES = ["terms", "privacy", "pd", "documents"] as const;

/** Экран согласий: фиксируем согласия, consent → phone_input. */
export async function POST(): Promise<NextResponse> {
  const { user, res } = await loadUserForStep("consent");
  if (res) return res;

  // идемпотентно (BUG-2/ONB-5): UNIQUE(user_id, consent_type, consent_version) + ignore
  await supabaseAdmin()
    .from("consents")
    .upsert(
      CONSENT_TYPES.map((t) => ({
        user_id: user.id,
        consent_type: t,
        consent_version: CONSENT_VERSION,
      })),
      { onConflict: "user_id,consent_type,consent_version", ignoreDuplicates: true },
    );

  const tr = await tryTransition(user.id, { onboarding_step: "phone_input" }, "accepted consents", {
    kind: "user",
    id: user.id,
  });
  if (!tr.ok) return NextResponse.json({ ok: false, error: tr.error }, { status: 409 });
  return NextResponse.json({ ok: true, next: ONBOARDING_PATHS.phone_input });
}
