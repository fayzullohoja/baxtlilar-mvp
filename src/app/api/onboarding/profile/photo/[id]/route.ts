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
    .select("id, path")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!photo) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

  await sb.storage.from(BUCKET_PHOTOS).remove([photo.path as string]);
  const { error: delErr } = await sb.from("profile_photos").delete().eq("id", id);
  // не отвечаем «ok», если строка не удалилась — иначе пользователь думает, что фото
  // убрано, а оно осталось и продолжает показываться.
  if (delErr) return NextResponse.json({ ok: false, error: "failed" }, { status: 500 });

  // Экран 13: is_main ≡ portrait (upload-роут ставит is_main только для portrait).
  // Промоушен «самого раннего оставшегося» в main здесь БОЛЬШЕ НЕ делаем — иначе
  // (а) family могло бы стать main → CHECK profile_photos_family_not_main_chk (500),
  // (б) full_body стало бы main, а повторная загрузка portrait дала бы второй is_main
  //     → unique-index profile_photos_one_main (500). Портрет обязателен на photos-done,
  // поэтому после удаления портрета пользователь загрузит новый — он и станет main.
  return NextResponse.json({ ok: true });
}
