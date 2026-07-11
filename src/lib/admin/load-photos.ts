import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { signedDocumentUrls, signedPhotoUrls } from "@/lib/uploads/storage";
import { unwrapRows } from "@/lib/db/unwrap";
import { ageFromDate } from "@/lib/profile/schemas";

export type PhotoCase = {
  photo_id: string;
  user_id: string;
  path: string;
  signed_url: string | null;
  ord: number;
  is_main: boolean;
  status: string;
  photo_type: string; // portrait | full_body | family (PH-2)
  created_at: string;
  client: {
    display_name: string | null;
    telegram_first_name: string | null;
    age: number | null;
    city: string | null;
    avatar_url: string | null;
    verification_status: string;
  };
};

export type PhotosFilter = "new" | "overdue";

const PAGE_DEFAULT = 60;

/**
 * Очередь фото на модерацию (status under_review/uploaded) + контекст клиента
 * (имя, возраст, город, аватар) одним проходом. Запросы раздельные и сшиваются
 * в JS — query-builder не умеет embed/!inner (см. baxtlilar-db-error-discipline).
 * DB-ошибки поднимаются через unwrapRows (иначе сбой = тихо пустая очередь).
 *
 * Курсор-пагинация по created_at ASC: следующая страница — created_at > cursor.
 */
export async function loadPhotosQueue(
  filter: PhotosFilter = "new",
  limit = PAGE_DEFAULT,
  cursor?: string,
): Promise<{ rows: PhotoCase[]; next_cursor?: string }> {
  const sb = supabaseAdmin();

  let q = sb
    .from("profile_photos")
    .select("id, user_id, path, ord, is_main, status, photo_type, created_at")
    .in("status", ["under_review", "uploaded"])
    .order("created_at", { ascending: true });

  if (filter === "overdue") {
    const overdueLine = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    q = q.lt("created_at", overdueLine);
  }
  if (cursor) q = q.gt("created_at", cursor);

  // .limit() — терминальный вызов; +1 чтобы определить next_cursor.
  const raw = unwrapRows(await q.limit(limit + 1)) as Array<{
    id: string;
    user_id: string;
    path: string;
    ord: number;
    is_main: boolean;
    status: string;
    photo_type: string;
    created_at: string;
  }>;

  const hasMore = raw.length > limit;
  const rows = hasMore ? raw.slice(0, limit) : raw;
  if (rows.length === 0) return { rows: [] };

  const userIds = Array.from(new Set(rows.map((r) => r.user_id)));
  const [profilesRes, usersRes, photoUrls] = await Promise.all([
    sb
      .from("user_profiles")
      .select("user_id, display_name, birth_date, city")
      .in("user_id", userIds),
    sb
      .from("users")
      .select("id, telegram_first_name, avatar_path, verification_status")
      .in("id", userIds),
    signedPhotoUrls(
      rows.map((r) => r.path),
      300,
    ),
  ]);
  const profiles = unwrapRows(profilesRes);
  const users = unwrapRows(usersRes);

  const profileByUser = new Map(
    profiles.map((p) => [p.user_id as string, p]),
  );
  const userById = new Map(users.map((u) => [u.id as string, u]));
  const avatarUrlByPath = await signedDocumentUrls(
    users.map((u) => u.avatar_path as string | null),
  );

  const out: PhotoCase[] = rows.map((r) => {
    const u = userById.get(r.user_id);
    const p = profileByUser.get(r.user_id);
    const avatarPath = (u?.avatar_path as string | null) ?? null;
    return {
      photo_id: r.id,
      user_id: r.user_id,
      path: r.path,
      signed_url: photoUrls[r.path] ?? null,
      ord: r.ord,
      is_main: r.is_main,
      status: r.status,
      photo_type: r.photo_type ?? "portrait",
      created_at: r.created_at,
      client: {
        display_name: (p?.display_name as string | null) ?? null,
        telegram_first_name: (u?.telegram_first_name as string | null) ?? null,
        age: p?.birth_date ? ageFromDate(p.birth_date as string) : null,
        city: (p?.city as string | null) ?? null,
        avatar_url: avatarPath ? (avatarUrlByPath[avatarPath] ?? null) : null,
        verification_status: (u?.verification_status as string) ?? "unknown",
      },
    };
  });

  return {
    rows: out,
    next_cursor: hasMore ? rows[rows.length - 1].created_at : undefined,
  };
}
