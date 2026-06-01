import { NextRequest, NextResponse } from "next/server";
import { loadUserForStep } from "@/lib/onboarding/guard-api";
import { transition } from "@/lib/state-machine/transitions";
import { ONBOARDING_PATHS } from "@/lib/state-machine/router";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** «Начать» на welcome: сохранить язык, перейти language → consent. */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const { user, res } = await loadUserForStep("language");
  if (res) return res;

  let language: "ru" | "uz" = user.language ?? "ru";
  try {
    const body = (await req.json()) as { language?: string };
    if (body.language === "ru" || body.language === "uz") language = body.language;
  } catch {
    /* язык необязателен в теле */
  }

  await transition(user.id, { language, onboarding_step: "consent" }, "user pressed start", {
    kind: "user",
    id: user.id,
  });
  return NextResponse.json({ ok: true, next: ONBOARDING_PATHS.consent });
}
