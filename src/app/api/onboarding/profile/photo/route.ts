import { NextRequest, NextResponse } from "next/server";
import { loadUserForStep } from "@/lib/onboarding/guard-api";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { uploadProfilePhoto } from "@/lib/uploads/storage";
import { PHOTO_TYPE, vals } from "@/lib/profile/options";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_PHOTOS = 3;
const ALLOWED_TYPES = vals(PHOTO_TYPE); // portrait | full_body | family

/**
 * Загрузка фото профиля (до 3, по одному на тип-слот — Экран 13).
 * portrait = главное (is_main, видно pre-mutual). full_body/family — не главные;
 * family дополнительно гейтится post-mutual в get_recommendations (миграция 20260711020000).
 * Статус under_review (реактивная модерация).
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const { user, res } = await loadUserForStep("profile_photos");
  if (res) return res;
  const sb = supabaseAdmin();

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File))
    return NextResponse.json({ ok: false, error: "no_file" }, { status: 400 });

  // Тип слота (по умолчанию portrait для обратной совместимости старого клиента).
  const photoType = String(form?.get("photo_type") ?? "portrait");
  if (!ALLOWED_TYPES.includes(photoType))
    return NextResponse.json({ ok: false, error: "bad_type" }, { status: 400 });

  const { data: existing } = await sb
    .from("profile_photos")
    .select("photo_type")
    .eq("user_id", user.id);
  const count = existing?.length ?? 0;
  if (count >= MAX_PHOTOS)
    return NextResponse.json({ ok: false, error: "max_photos" }, { status: 400 });
  // Один слот на тип: если фото этого типа уже есть — сначала удалить его.
  if (existing?.some((p) => p.photo_type === photoType))
    return NextResponse.json({ ok: false, error: "type_exists" }, { status: 400 });

  // Стабильный индекс файла по типу (portrait=0, full_body=1, family=2) —
  // разные типы не перезаписывают storage-файлы друг друга.
  const idx = ALLOWED_TYPES.indexOf(photoType);

  const up = await uploadProfilePhoto(user.id, idx, await file.arrayBuffer());
  if (!up.ok) return NextResponse.json({ ok: false, error: up.error }, { status: 400 });

  const { data: inserted, error } = await sb
    .from("profile_photos")
    .insert({
      user_id: user.id,
      path: up.path,
      photo_type: photoType,
      is_main: photoType === "portrait", // только портрет — главное фото
      status: "under_review",
      ord: idx,
    })
    .select("id, is_main, photo_type")
    .single();
  if (error || !inserted)
    return NextResponse.json({ ok: false, error: "db_failed" }, { status: 500 });

  return NextResponse.json({
    ok: true,
    photo: {
      id: inserted.id,
      url: up.url,
      is_main: inserted.is_main,
      photo_type: inserted.photo_type,
    },
  });
}
