import { NextRequest, NextResponse } from "next/server";
import { loadUserForStep } from "@/lib/onboarding/guard-api";
import { tryTransition } from "@/lib/state-machine/transitions";
import { ONBOARDING_PATHS } from "@/lib/state-machine/router";
import { recordBiometricConsent } from "@/lib/consent/biometric";
import { trustedIp } from "@/lib/http/ip";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/onboarding/verification-intro/continue
 *
 * Юзер прочитал intro (+ согласие на биометрию) и жмёт CTA «Даю согласие и
 * продолжаю» → записываем согласие на биометрию (перенесено из бота 2026-07-10),
 * затем переход verification_intro → doc_upload.
 *
 * Idempotency (risk #8): если юзер уже на doc_upload (double-tap, гонка двух
 * вкладок), возвращаем 409 alreadyAdvanced — клиент трактует как success и
 * редиректит на /onboarding/document. Это лучше, чем 4xx-toast в лицо.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const { user, res } = await loadUserForStep();
  if (res) return res;

  if (user.onboarding_step === "doc_upload") {
    return NextResponse.json(
      { ok: false, error: "already_advanced", next: ONBOARDING_PATHS.doc_upload },
      { status: 409 },
    );
  }
  if (user.onboarding_step !== "verification_intro") {
    return NextResponse.json(
      { ok: false, error: "wrong_step", current: user.onboarding_step },
      { status: 409 },
    );
  }

  // Согласие на биометрию — ДО перехода (atomic: если запись упала, шаг не
  // двигаем). Дублируется enforcement'ом в upload-роутах для retry-путей,
  // которые минуют intro (needs_changes/verification_rejected → doc_upload).
  // IP берём через trustedIp, а НЕ левым сегментом X-Forwarded-For. Левые
  // сегменты приходят от клиента и подделываются: человек мог бы подписать
  // согласие на биометрию с любым адресом, вплоть до чужого. Согласие -
  // юридический документ, и в споре «я такого не подписывал» запись обязана
  // указывать на реальный адрес. trustedIp читает то, что проставил наш edge,
  // и уже используется так в 18 других местах - здесь его просто забыли позвать.
  const ip = trustedIp(req);
  const ua = req.headers.get("user-agent") || "miniapp";
  const consent = await recordBiometricConsent({
    userId: user.id,
    telegramId: user.telegram_id ?? 0,
    lang: user.language ?? "ru",
    ip,
    userAgent: ua,
  });
  if (!consent.ok) {
    return NextResponse.json({ ok: false, error: "consent_failed" }, { status: 500 });
  }

  const tr = await tryTransition(
    user.id,
    { onboarding_step: "doc_upload" },
    "user:verification_intro_acknowledged",
    { kind: "user", id: user.id },
  );
  if (!tr.ok) {
    return NextResponse.json({ ok: false, error: tr.error }, { status: 409 });
  }
  return NextResponse.json({ ok: true, next: ONBOARDING_PATHS.doc_upload });
}
