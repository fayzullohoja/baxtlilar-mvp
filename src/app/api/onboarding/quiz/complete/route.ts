import { NextRequest, NextResponse } from "next/server";
import { loadUserForStep } from "@/lib/onboarding/guard-api";
import { tryTransition } from "@/lib/state-machine/transitions";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { QUESTION_IDS } from "@/lib/quiz/questions";
import { computeVector } from "@/lib/quiz/scoring";
import { ONBOARDING_PATHS } from "@/lib/state-machine/router";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Завершение опроса: сохраняем ответы + вектор → пользователь становится active. */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const { user, res } = await loadUserForStep("quiz");
  if (res) return res;

  const body = (await req.json().catch(() => ({}))) as {
    answers?: { question_id?: string; value?: number }[];
  };
  const raw = Array.isArray(body.answers) ? body.answers : [];
  const answers = raw
    .filter(
      (a) =>
        typeof a.question_id === "string" &&
        QUESTION_IDS.includes(a.question_id) &&
        Number.isInteger(a.value) &&
        (a.value as number) >= 1 &&
        (a.value as number) <= 5,
    )
    .map((a) => ({ question_id: a.question_id as string, value: a.value as number }));

  // требуем ответы на все вопросы (MVP: опрос обязателен целиком)
  const uniqueIds = new Set(answers.map((a) => a.question_id));
  if (uniqueIds.size < QUESTION_IDS.length)
    return NextResponse.json({ ok: false, error: "incomplete_quiz" }, { status: 400 });

  const sb = supabaseAdmin();
  // Ответы и вектор подбора должны лечь в БД ДО перехода в active: иначе пользователь
  // становится активным без вектора → ломается выдача рекомендаций.
  const { error: ansErr } = await sb
    .from("quiz_answers")
    .upsert(
      answers.map((a) => ({ user_id: user.id, question_id: a.question_id, answer_value: String(a.value) })),
      { onConflict: "user_id,question_id" },
    );
  if (ansErr) return NextResponse.json({ ok: false, error: "save_failed" }, { status: 500 });

  const vector = computeVector(answers);
  const { error: resErr } = await sb
    .from("quiz_results")
    .upsert({ user_id: user.id, vector }, { onConflict: "user_id" });
  if (resErr) return NextResponse.json({ ok: false, error: "save_failed" }, { status: 500 });

  const tr = await tryTransition(
    user.id,
    { onboarding_step: "active", lifecycle_state: "active", quiz_completion: "completed" },
    "quiz completed → active",
    { kind: "user", id: user.id },
  );
  if (!tr.ok) return NextResponse.json({ ok: false, error: tr.error }, { status: 409 });
  return NextResponse.json({ ok: true, next: ONBOARDING_PATHS.active });
}
