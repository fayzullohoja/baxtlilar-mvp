import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi, adminAudit } from "@/lib/admin/guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { BUCKET_DOCUMENTS } from "@/lib/uploads/storage";
import { trustedIp } from "@/lib/http/ip";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Signed URL для паспорта/селфи (TTL 5 мин). Доступ логируется (чувствительные данные). */
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

  const { data: doc } = await supabaseAdmin()
    .from("user_documents")
    .select("passport_path, selfie_path")
    .eq("user_id", id)
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
    entityId: id,
    newValue: { kind },
    reason: "moderation review",
    ip: trustedIp(req),
  });

  return NextResponse.json({ ok: true, url: signed.signedUrl });
}
