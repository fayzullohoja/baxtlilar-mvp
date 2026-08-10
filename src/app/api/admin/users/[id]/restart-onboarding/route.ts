import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin/guard";
import { can } from "@/lib/admin/permissions";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { unwrapRows, unwrapOne } from "@/lib/db/unwrap";
import { BUCKET_DOCUMENTS, BUCKET_PHOTOS } from "@/lib/uploads/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// DZ-3: сброс онбординга (стирает анкету/фото/паспорт/квиз/СОГЛАСИЯ, возвращает
// на старт). Superadmin-only. Аудит + guard blocked/pending_ban — в RPC.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { session, res } = await requireAdminApi();
  if (res) return res;
  if (!can(session.role, "users.sanction"))
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  const { id } = await params;

  const body = (await req.json().catch(() => ({}))) as { reason?: string };
  const reason = (body.reason ?? "").trim();
  if (reason.length < 3)
    return NextResponse.json({ ok: false, error: "reason_required" }, { status: 400 });

  const sb = supabaseAdmin();

  // PII/KVKK: RPC стирает строки profile_photos + user_documents (паспорт+селфи) и
  // СОГЛАСИЯ, но файлы на volume не трогает. Собираем пути ДО вызова RPC, чтобы
  // после успешного рестарта дочистить их (иначе биометрия остаётся на диске без
  // строки-указателя и после отзыва согласия — как в hard-delete route).
  // unwrap* бросают на сбое БД — СПЕЦИАЛЬНО до деструктивного RPC: лучше
  // отказать в сбросе (500), чем стереть согласия и оставить биометрию с
  // паспортом на диске из-за молча провалившегося SELECT.
  const [photosRes, docsRes, userRes] = await Promise.all([
    sb.from("profile_photos").select("path").eq("user_id", id),
    sb.from("user_documents").select("passport_path, selfie_path").eq("user_id", id),
    sb.from("users").select("avatar_path").eq("id", id).maybeSingle(),
  ]);
  const photos = unwrapRows(photosRes);
  const docs = unwrapRows(docsRes);
  const urow = unwrapOne(userRes) as { avatar_path?: string | null } | null;
  const paths = [
    ...photos.map((p) => (p as { path: string }).path),
    ...docs.flatMap((d) => {
      const row = d as { passport_path: string | null; selfie_path: string | null };
      return [row.passport_path, row.selfie_path];
    }),
    urow?.avatar_path ?? null,
  ].filter((p): p is string => !!p);

  const { data, error } = await sb.rpc("admin_restart_onboarding", {
    p_user_id: id,
    p_admin_id: session.adminId,
    p_reason: reason,
  });
  if (error) {
    console.error("[restart-onboarding] RPC error:", error.message);
    return NextResponse.json({ ok: false, error: "internal" }, { status: 500 });
  }
  const r = data as { ok: boolean; error?: string };
  if (!r.ok)
    return NextResponse.json(r, { status: r.error === "not_found" ? 404 : 409 });

  // best-effort: удаляем осиротевшие файлы из обоих приватных бакетов (rows уже
  // стёрты RPC). Неверный бакет для пути — no-op/ошибка, глушим.
  if (paths.length) {
    for (const bucket of [BUCKET_PHOTOS, BUCKET_DOCUMENTS]) {
      try {
        await sb.storage.from(bucket).remove(paths);
      } catch (e) {
        console.error(`[restart-onboarding] storage cleanup (${bucket}) failed:`, e);
      }
    }
  }
  return NextResponse.json({ ok: true });
}
