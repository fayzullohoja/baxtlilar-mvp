import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { BUCKET_DOCUMENTS, signedPhotoUrls } from "@/lib/uploads/storage";

export type PhotoCase = {
  photo_id: string;
  user_id: string;
  path: string;
  signed_url: string | null;
  ord: number;
  is_main: boolean;
  status: string;
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

function ageFromBirthDate(bd: string | null): number | null {
  if (!bd) return null;
  const d = new Date(bd);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  if (
    now.getMonth() < d.getMonth() ||
    (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())
  )
    age--;
  return age;
}

/**
 * Очередь фото на модерацию (status under_review/uploaded) + контекст клиента
 * (имя, возраст, город, аватар) одним проходом. Запросы раздельные и сшиваются
 * в JS — query-builder не умеет embed/!inner (см. baxtlilar-db-error-discipline).
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
    .select("id, user_id, path, ord, is_main, status, created_at")
    .in("status", ["under_review", "uploaded"])
    .order("created_at", { ascending: true });

  if (filter === "overdue") {
    const overdueLine = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    q = q.lt("created_at", overdueLine);
  }
  if (cursor) q = q.gt("created_at", cursor);

  // .limit() — терминальный вызов; +1 чтобы определить next_cursor.
  const { data: photos } = await q.limit(limit + 1);
  const raw = (photos ?? []) as Array<{
    id: string;
    user_id: string;
    path: string;
    ord: number;
    is_main: boolean;
    status: string;
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

  const profileByUser = new Map(
    (profilesRes.data ?? []).map((p) => [p.user_id as string, p]),
  );
  const userById = new Map(
    (usersRes.data ?? []).map((u) => [u.id as string, u]),
  );

  // Аватары лежат в приватном bucket документов (avatar = одобренное селфи) —
  // подписываем пачкой одним round-trip'ом.
  const avatarPaths = Array.from(
    new Set(
      (usersRes.data ?? [])
        .map((u) => u.avatar_path as string | null)
        .filter((p): p is string => !!p),
    ),
  );
  const avatarUrlByPath = new Map<string, string>();
  if (avatarPaths.length) {
    const { data } = await sb.storage
      .from(BUCKET_DOCUMENTS)
      .createSignedUrls(avatarPaths, 300);
    for (const it of data ?? [])
      if (it.path && it.signedUrl) avatarUrlByPath.set(it.path, it.signedUrl);
  }

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
      created_at: r.created_at,
      client: {
        display_name: (p?.display_name as string | null) ?? null,
        telegram_first_name: (u?.telegram_first_name as string | null) ?? null,
        age: ageFromBirthDate((p?.birth_date as string | null) ?? null),
        city: (p?.city as string | null) ?? null,
        avatar_url: avatarPath
          ? (avatarUrlByPath.get(avatarPath) ?? null)
          : null,
        verification_status: (u?.verification_status as string) ?? "unknown",
      },
    };
  });

  return {
    rows: out,
    next_cursor: hasMore ? rows[rows.length - 1].created_at : undefined,
  };
}
