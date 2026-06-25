import { NextRequest, NextResponse } from "next/server";
import { loadUserForStep } from "@/lib/onboarding/guard-api";
import { tryTransition } from "@/lib/state-machine/transitions";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ONBOARDING_PATHS } from "@/lib/state-machine/router";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_SOURCES = new Set<string>([
  "telegram",
  "instagram",
  "friends",
  "facebook",
  "tiktok",
  "youtube",
  "ads",
  "search",
  "media",
  "event",
  "other",
]);

/**
 * MAJOR #3 (spec Экран 12): пользователь выбирает источник привлечения ИЛИ
 * skip. attribution_source enum-валидно через CHECK constraint, NULL=skip
 * также валидно.
 *
 * V2 (2026-06-25): после attribution идём не в active, а в tutorial_intro.
 * Lifecycle_state остаётся 'onboarding' до окончания тура (см. tutorial route).
 * ALLOWED_TRANSITIONS.attribution позволяет ["tutorial_intro", "active"] —
 * "active" сохранён для legacy fallback, но новые регистрации идут в тур.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const { user, res } = await loadUserForStep("attribution");
  if (res) return res;

  const body = (await req.json().catch(() => ({}))) as {
    source?: string;
    skip?: boolean;
  };

  let source: string | null = null;
  if (!body.skip) {
    if (typeof body.source !== "string" || !ALLOWED_SOURCES.has(body.source)) {
      return NextResponse.json({ ok: false, error: "bad_source" }, { status: 400 });
    }
    source = body.source;
  }

  // Сохраняем source (или NULL при skip) до перехода в tutorial_intro.
  const { error: upErr } = await supabaseAdmin()
    .from("users")
    .update({ attribution_source: source })
    .eq("id", user.id);
  if (upErr) {
    console.error("[attribution] update failed:", upErr.message);
    return NextResponse.json({ ok: false, error: "save_failed" }, { status: 500 });
  }

  const tr = await tryTransition(
    user.id,
    { onboarding_step: "tutorial_intro" },
    source ? `attribution: ${source} → tutorial` : "attribution: skip → tutorial",
    { kind: "user", id: user.id },
  );
  if (!tr.ok) return NextResponse.json({ ok: false, error: tr.error }, { status: 409 });
  return NextResponse.json({ ok: true, next: ONBOARDING_PATHS.tutorial_intro });
}
