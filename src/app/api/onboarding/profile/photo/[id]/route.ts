import { NextRequest, NextResponse } from "next/server";
import { loadUserForStep } from "@/lib/onboarding/guard-api";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { BUCKET_PHOTOS } from "@/lib/uploads/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { user, res } = await loadUserForStep("profile_photos");
  if (res) return res;
  const { id } = await params;
  const sb = supabaseAdmin();

  const { data: photo } = await sb
    .from("profile_photos")
    .select("id, path, is_main")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!photo) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

  await sb.storage.from(BUCKET_PHOTOS).remove([photo.path as string]);
  const { error: delErr } = await sb.from("profile_photos").delete().eq("id", id);
  // не отвечаем «ok», если строка не удалилась — иначе пользователь думает, что фото
  // убрано, а оно осталось и продолжает показываться.
  if (delErr) return NextResponse.json({ ok: false, error: "failed" }, { status: 500 });

  // если удалили главное — назначить главным самое раннее из оставшихся (фикс «застрял без main»)
  if (photo.is_main) {
    const { data: rest } = await sb
      .from("profile_photos")
      .select("id")
      .eq("user_id", user.id)
      .order("ord", { ascending: true })
      .limit(1);
    if (rest?.[0]) await sb.from("profile_photos").update({ is_main: true }).eq("id", rest[0].id);
  }
  return NextResponse.json({ ok: true });
}
