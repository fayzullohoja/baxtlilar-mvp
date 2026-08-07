import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi, adminAudit } from "@/lib/admin/guard";
import { can } from "@/lib/admin/permissions";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { trustedIp } from "@/lib/http/ip";
import { notifyUser } from "@/lib/telegram/notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Реактивная модерация фото: approve/reject. Не влияет на онбординг-флоу пользователя. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { session, res } = await requireAdminApi();
  if (res) return res;
  if (!can(session.role, "photos.moderate"))
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as {
    action?: "approve" | "reject" | "needs_replacement";
    reason?: string; // legacy shape
    reason_code?: string; // new shape (reason templates)
    reason_text?: string;
  };
  const action = body.action;
  const reasonText = body.reason_text ?? body.reason ?? null;
  const reasonCode = body.reason_code ?? null;
  // PH-4: needs_replacement — мягче reject (слот сохраняется, просим заменить).
  const isNegative = action === "reject" || action === "needs_replacement";
  if (action !== "approve" && !isNegative)
    return NextResponse.json({ ok: false, error: "bad_action" }, { status: 400 });

  const { data: photo } = await supabaseAdmin()
    .from("profile_photos")
    .select("id, user_id, status")
    .eq("id", id)
    .maybeSingle();
  if (!photo) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

  // F-120 + C4 verdict-fix: moderator может действовать только над фото,
  // которое (1) в активной модерации (status='under_review'/'uploaded') И
  // (2) принадлежит юзеру, который сам находится в одобренном или активном
  // lifecycle (не deleted/blocked). Без owner-scope-чека moderator мог
  // "deplatform" любого через массовый reject.
  if (session.role !== "superadmin") {
    if (photo.status !== "under_review" && photo.status !== "uploaded") {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }
    const { data: owner } = await supabaseAdmin()
      .from("users")
      .select("lifecycle_state")
      .eq("id", photo.user_id)
      .maybeSingle();
    if (!owner || owner.lifecycle_state === "deleted" || owner.lifecycle_state === "blocked") {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }
  }

  // Сначала убеждаемся, что апдейт реально применился, и только потом пишем аудит —
  // иначе журнал зафиксирует «фантомное» решение (approve/reject), которого в БД нет.
  const newStatus =
    action === "approve"
      ? "approved"
      : action === "needs_replacement"
        ? "needs_replacement"
        : "rejected";
  const { error } = await supabaseAdmin()
    .from("profile_photos")
    .update({
      status: newStatus,
      reject_reason: isNegative ? reasonText : null,
    })
    .eq("id", id);
  if (error) return NextResponse.json({ ok: false, error: "failed" }, { status: 500 });

  await adminAudit({
    adminId: session.adminId,
    action: `photo_${action}`,
    entity: "profile_photo",
    entityId: id,
    newValue: { status: action, reason_code: reasonCode, reason_text: reasonText },
    reason: reasonText ?? undefined,
    ip: trustedIp(req),
  });

  // PH-1/PH-4: при reject/needs_replacement уведомляем юзера через бота
  // (best-effort). Раньше фото молча исчезало из выдачи — юзер не знал причину.
  if (isNegative) {
    const { data: u } = await supabaseAdmin()
      .from("users")
      .select("telegram_id, language")
      .eq("id", photo.user_id)
      .maybeSingle();
    const uz = u?.language === "uz";
    const reasonLine = reasonText
      ? uz
        ? `\nSabab: ${reasonText}`
        : `\nПричина: ${reasonText}`
      : "";
    // needs_replacement — мягче: слот остаётся, просто просим заменить.
    const msg =
      action === "needs_replacement"
        ? uz
          ? `Iltimos, ushbu suratni boshqasiga almashtiring.${reasonLine}`
          : `Пожалуйста, замените это фото на другое.${reasonLine}`
        : uz
          ? `Suratingiz moderatsiyadan oʻtmadi.${reasonLine}\nIltimos, boshqa surat yuklang.`
          : `Ваше фото не прошло модерацию.${reasonLine}\nПожалуйста, загрузите другое фото.`;
    await notifyUser((u?.telegram_id as number | null) ?? null, msg);
  }

  return NextResponse.json({ ok: true });
}
