import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi, adminAudit, requireInQueueOrSuper } from "@/lib/admin/guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { BUCKET_DOCUMENTS } from "@/lib/uploads/storage";
import { trustedIp } from "@/lib/http/ip";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Signed URL для паспорта/селфи (TTL 5 мин). Доступ логируется.
 *
 * F-120: moderator может смотреть документы ТОЛЬКО юзеров в активной очереди
 * модерации (verification_status='pending_review' + lifecycle='onboarding').
 * Out-of-queue → 403 + строка в admin_scope_violations (без plaintext user_id;
 * только HMAC-хеш).
 * superadmin — без ограничений (incident-response).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { session, res } = await requireAdminApi();
  if (res) return res;
  const { id } = await params;
  const kind = new URL(req.url).searchParams.get("kind");
  if (kind !== "passport" && kind !== "selfie")
    return NextResponse.json({ ok: false, error: "bad_kind" }, { status: 400 });

  const scope = await requireInQueueOrSuper(session, id, "doc_view", req);
  if ("res" in scope) return scope.res;

  const { data: doc } = await supabaseAdmin()
    .from("user_documents")
    .select("passport_path, selfie_path")
    .eq("user_id", scope.userId)
    .maybeSingle();
  const path = kind === "passport" ? doc?.passport_path : doc?.selfie_path;
  if (!path) return NextResponse.json({ ok: false, error: "no_document" }, { status: 404 });

  const { data: signed, error } = await supabaseAdmin()
    .storage.from(BUCKET_DOCUMENTS)
    .createSignedUrl(path as string, 300);
  if (error || !signed)
    return NextResponse.json({ ok: false, error: "sign_failed" }, { status: 500 });

  await adminAudit({
    adminId: session.adminId,
    action: "view_document",
    entity: "user",
    entityId: scope.userId,
    newValue: { kind },
    reason: "moderation review",
    ip: trustedIp(req),
  });

  return NextResponse.json({ ok: true, url: signed.signedUrl });
}
