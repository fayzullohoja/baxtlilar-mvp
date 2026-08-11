import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi, adminAudit } from "@/lib/admin/guard";
import { can } from "@/lib/admin/permissions";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { trustedIp } from "@/lib/http/ip";
import { disableCodesOfUser } from "@/lib/invite/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Кнопка «Погасить» в /admin/invites. reason ВСЕГДА "leak": это единственный
 * путь гашения кода из этого раздела (в отличие от ban/unban, где reason -
 * "ban" - см. src/lib/admin/guard.ts), поэтому свободный текст причины не
 * заводим - предсказуемая строка проще читать в журнале и в фильтрах
 * disabled_reason, чем произвольный текст модератора.
 *
 * ⛔ Второе предупреждение ревью Task 8: сбой гашения обязан быть ВИДЕН
 * оператору сразу. В отличие от ban-confirm (guard.ts) здесь НЕТ уже
 * закоммиченного действия ДО этого шага - гашение и есть вся операция
 * целиком, поэтому сбой просто честно превращается в 500 { ok:false }
 * (никакого catch-and-continue с "успешным" ответом и незамеченным флагом) -
 * InvitesManager.tsx показывает это как обычную видимую ошибку.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { session, res } = await requireAdminApi();
  if (res) return res;
  if (!can(session.role, "invites.manage"))
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  const { id } = await params;
  const sb = supabaseAdmin();
  const { data: row, error: loadError } = await sb
    .from("invite_codes")
    .select("id, owner_id, disabled_at")
    .eq("id", id)
    .maybeSingle();
  if (loadError) return NextResponse.json({ ok: false, error: "internal" }, { status: 500 });
  if (!row) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  if (row.disabled_at)
    return NextResponse.json({ ok: false, error: "already_disabled" }, { status: 409 });

  const ownerId = row.owner_id as string | null;
  try {
    if (ownerId) {
      // Персональный код - гасим ЧЕРЕЗ disableCodesOfUser (та же функция, что
      // и бан в guard.ts): она же закрывает персональный запрет приглашать
      // (users.invite_revoked_at) - см. ⛔-комментарий в store.ts про
      // самоотмену гашения, которую этот путь как раз и включает первым.
      await disableCodesOfUser(ownerId, "leak");
    } else {
      // Мастер-код: владельца нет, закрывать персональное право некому -
      // просто гасим саму строку.
      const { error } = await sb
        .from("invite_codes")
        .update({ disabled_at: new Date().toISOString(), disabled_reason: "leak" })
        .eq("id", id)
        .is("disabled_at", null);
      if (error) throw new Error(error.message);
    }
  } catch (e) {
    console.error(`[admin/invites] гашение кода ${id} провалилось:`, e);
    return NextResponse.json({ ok: false, error: "internal" }, { status: 500 });
  }

  await adminAudit({
    adminId: session.adminId,
    action: "invite_code_disabled",
    entity: "invite_code",
    entityId: id,
    oldValue: { disabled_at: null },
    newValue: { disabled_reason: "leak", owner_id: ownerId },
    reason: "leak",
    ip: trustedIp(req),
  });
  return NextResponse.json({ ok: true });
}
