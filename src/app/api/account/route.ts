import { NextRequest, NextResponse } from "next/server";
import { loadActiveUserApi } from "@/lib/auth/active-guard";
import { tryTransition } from "@/lib/state-machine/transitions";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { clearSession } from "@/lib/auth/session";
import { BUCKET_PHOTOS, BUCKET_DOCUMENTS } from "@/lib/uploads/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const { user, res } = await loadActiveUserApi({ allowPaused: true });
  if (res) return res;
  const { action } = (await req.json().catch(() => ({}))) as { action?: "pause" | "resume" | "delete" };
  const sb = supabaseAdmin();

  if (action === "pause") {
    if (user.lifecycle_state !== "active")
      return NextResponse.json({ ok: false, error: "not_active" }, { status: 409 });
    const tr = await tryTransition(user.id, { lifecycle_state: "paused" }, "user paused", {
      kind: "user",
      id: user.id,
    });
    return tr.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ ok: false, error: tr.error }, { status: 409 });
  }

  if (action === "resume") {
    if (user.lifecycle_state !== "paused")
      return NextResponse.json({ ok: false, error: "not_paused" }, { status: 409 });
    const tr = await tryTransition(user.id, { lifecycle_state: "active" }, "user resumed", {
      kind: "user",
      id: user.id,
    });
    return tr.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ ok: false, error: tr.error }, { status: 409 });
  }

  if (action === "delete") {
    // soft-delete: помечаем deleted, стираем ПД и файлы, чистим сессию (запись остаётся для аудита)
    await tryTransition(user.id, { lifecycle_state: "deleted" }, "user deleted account", {
      kind: "user",
      id: user.id,
    });
    await sb
      .from("users")
      .update({ deleted_at: new Date().toISOString(), phone_number: null, phone_verified: false })
      .eq("id", user.id);

    const { data: photos } = await sb.from("profile_photos").select("path").eq("user_id", user.id);
    const photoPaths = (photos ?? []).map((p) => p.path as string);
    if (photoPaths.length) await sb.storage.from(BUCKET_PHOTOS).remove(photoPaths);
    await sb.from("profile_photos").delete().eq("user_id", user.id);

    const { data: docFiles } = await sb.storage.from(BUCKET_DOCUMENTS).list(user.id);
    if (docFiles?.length)
      await sb.storage.from(BUCKET_DOCUMENTS).remove(docFiles.map((f) => `${user.id}/${f.name}`));

    await clearSession();
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, error: "bad_action" }, { status: 400 });
}
