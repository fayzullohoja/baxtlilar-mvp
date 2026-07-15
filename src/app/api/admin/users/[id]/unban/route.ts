import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi, adminAudit } from "@/lib/admin/guard";
import { can } from "@/lib/admin/permissions";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { tryTransition } from "@/lib/state-machine/transitions";
import type { LifecycleState } from "@/lib/state-machine/types";
import { trustedIp } from "@/lib/http/ip";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { session, res } = await requireAdminApi();
  if (res) return res;
  if (!can(session.role, "users.sanction"))
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  const { id } = await params;

  const { data: u } = await supabaseAdmin()
    .from("users")
    .select("profile_completion, lifecycle_state, pending_ban_prev_lifecycle")
    .eq("id", id)
    .maybeSingle();
  if (!u) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  // F-119: unban имеет смысл только для blocked. Для pending_ban есть отдельный
  // action ban?action=cancel; для остальных — 409 not_blocked (раньше тихо
  // переводил кого попало в active/onboarding).
  if (u.lifecycle_state !== "blocked")
    return NextResponse.json({ ok: false, error: "not_blocked", state: u.lifecycle_state }, { status: 409 });
  // AUTH-1 parity: восстанавливаем ИСТИННОЕ pre-ban состояние (propose пишет его в
  // pending_ban_prev_lifecycle; ban_cancel/expire уже используют его, а blocked→unban
  // путь раньше — нет). Иначе self-paused юзер после ban→unban воскресал active и
  // снова становился видим в ленте вопреки своей паузе. Fallback на publish-derive,
  // если prev пуст/невалиден (blocked/deleted).
  // Фаза 4 (§1.20): fallback по profile_completion (⟺ прошёл publish-гейт), а не
  // quiz_completion — после переноса preview опрос идёт ДО публикации, иначе
  // не-опубликованный юзер мог бы воскреснуть active мимо gender-check/фото.
  const prev = u.pending_ban_prev_lifecycle as LifecycleState | null;
  const safePrev = prev && prev !== "blocked" && prev !== "deleted" ? prev : null;
  const restored: LifecycleState =
    safePrev ?? (u.profile_completion === "completed" ? "active" : "onboarding");

  // M18: снимаем blocked_at/blocked_reason в том же атомарном переходе
  const tr = await tryTransition(
    id,
    { lifecycle_state: restored, blocked_at: null, blocked_reason: null },
    "unbanned",
    { kind: "admin", id: session.adminId },
  );
  if (!tr.ok) return NextResponse.json({ ok: false, error: tr.error }, { status: 409 });
  // Чистим использованный prev-lifecycle (transition_user его не трогает — не в whitelist).
  // Best-effort: если не прошло, значение перезапишется при следующем ban-propose.
  await supabaseAdmin()
    .from("users")
    .update({ pending_ban_prev_lifecycle: null })
    .eq("id", id);
  await adminAudit({
    adminId: session.adminId,
    action: "unban_user",
    entity: "user",
    entityId: id,
    newValue: { lifecycle_state: restored },
    ip: trustedIp(req),
  });
  return NextResponse.json({ ok: true });
}
