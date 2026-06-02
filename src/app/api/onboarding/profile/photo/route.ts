import { NextRequest, NextResponse } from "next/server";
import { loadUserForStep } from "@/lib/onboarding/guard-api";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { uploadProfilePhoto } from "@/lib/uploads/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_PHOTOS = 3;

/** Загрузка фото профиля (до 3). Первое = главное. Статус under_review (реактивная модерация). */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const { user, res } = await loadUserForStep("profile_photos");
  if (res) return res;
  const sb = supabaseAdmin();

  const { data: existing } = await sb
    .from("profile_photos")
    .select("id")
    .eq("user_id", user.id);
  const count = existing?.length ?? 0;
  if (count >= MAX_PHOTOS)
    return NextResponse.json({ ok: false, error: "max_photos" }, { status: 400 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File))
    return NextResponse.json({ ok: false, error: "no_file" }, { status: 400 });

  const up = await uploadProfilePhoto(user.id, count, await file.arrayBuffer());
  if (!up.ok) return NextResponse.json({ ok: false, error: up.error }, { status: 400 });

  const { data: inserted, error } = await sb
    .from("profile_photos")
    .insert({
      user_id: user.id,
      path: up.path,
      is_main: count === 0,
      status: "under_review",
      ord: count,
    })
    .select("id, is_main")
    .single();
  if (error || !inserted)
    return NextResponse.json({ ok: false, error: "db_failed" }, { status: 500 });

  return NextResponse.json({
    ok: true,
    photo: { id: inserted.id, url: up.url, is_main: inserted.is_main },
  });
}
