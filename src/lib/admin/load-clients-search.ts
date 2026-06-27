import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { BUCKET_DOCUMENTS } from "@/lib/uploads/storage";

export type ClientRow = {
  user_id: string;
  display_name: string | null;
  full_name: string | null; // из user_identity если есть
  age: number | null;
  city: string | null;
  pinfl: string | null;
  passport: string | null;
  telegram_username: string | null;
  phone_number_masked: string | null;
  verification_status: string;
  lifecycle_state: string;
  avatar_url: string | null;
  created_at: string;
};

function maskPhone(p: string): string {
  if (p.length < 6) return p;
  return p.slice(0, 4) + " *** " + p.slice(-4);
}

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
 * Поиск клиентов для /admin/clients. Матчинг живёт в RPC admin_search_clients
 * (ПИНФЛ/паспорт/@username/телефон/ФИО через pg_trgm) — она возвращает
 * ранжированный массив user_id; здесь дотягиваем строки и сшиваем, СОХРАНЯЯ
 * порядок релевантности.
 *
 * Пустой q → последние зарегистрированные (директория показывает их по
 * умолчанию). Это намеренная верхняя граница, не пагинация — см. note в UI.
 */
export async function searchClients(
  q: string,
  limit = 50,
): Promise<{ rows: ClientRow[] }> {
  const sb = supabaseAdmin();

  const { data: rpcData } = await sb.rpc("admin_search_clients", {
    p_q: q ?? "",
    p_limit: limit,
  });
  const ids = Array.isArray(rpcData) ? (rpcData as string[]) : [];
  if (ids.length === 0) return { rows: [] };

  const [usersRes, profilesRes, identsRes] = await Promise.all([
    sb
      .from("users")
      .select(
        "id, telegram_username, phone_number, verification_status, lifecycle_state, avatar_path, created_at",
      )
      .in("id", ids),
    sb
      .from("user_profiles")
      .select("user_id, display_name, city, birth_date")
      .in("user_id", ids),
    sb
      .from("user_identity")
      .select(
        "user_id, last_name, first_name, middle_name, pinfl, passport_series, passport_number, birth_date",
      )
      .is("superseded_at", null)
      .in("user_id", ids),
  ]);

  const userById = new Map(
    (usersRes.data ?? []).map((u) => [u.id as string, u]),
  );
  const profById = new Map(
    (profilesRes.data ?? []).map((p) => [p.user_id as string, p]),
  );
  const identById = new Map(
    (identsRes.data ?? []).map((i) => [i.user_id as string, i]),
  );

  const avatarPaths = Array.from(
    new Set(
      (usersRes.data ?? [])
        .map((u) => u.avatar_path as string | null)
        .filter((p): p is string => !!p),
    ),
  );
  const avatarUrlByPath = new Map<string, string>();
  if (avatarPaths.length) {
    const { data: signed } = await sb.storage
      .from(BUCKET_DOCUMENTS)
      .createSignedUrls(avatarPaths, 300);
    for (const it of signed ?? [])
      if (it.path && it.signedUrl) avatarUrlByPath.set(it.path, it.signedUrl);
  }

  // Порядок ids = порядок релевантности из RPC — сохраняем его.
  const rows: ClientRow[] = [];
  for (const id of ids) {
    const u = userById.get(id);
    if (!u) continue;
    const p = profById.get(id);
    const i = identById.get(id);
    const bd =
      (i?.birth_date as string | null) ??
      (p?.birth_date as string | null) ??
      null;
    const avatarPath = (u.avatar_path as string | null) ?? null;
    rows.push({
      user_id: id,
      display_name: (p?.display_name as string | null) ?? null,
      full_name: i
        ? `${i.last_name} ${i.first_name}${i.middle_name ? " " + i.middle_name : ""}`
        : null,
      age: ageFromBirthDate(bd),
      city: (p?.city as string | null) ?? null,
      pinfl: (i?.pinfl as string | null) ?? null,
      passport: i ? `${i.passport_series}${i.passport_number}` : null,
      telegram_username: (u.telegram_username as string | null) ?? null,
      phone_number_masked: u.phone_number
        ? maskPhone(u.phone_number as string)
        : null,
      verification_status: u.verification_status as string,
      lifecycle_state: u.lifecycle_state as string,
      avatar_url: avatarPath
        ? (avatarUrlByPath.get(avatarPath) ?? null)
        : null,
      created_at: u.created_at as string,
    });
  }
  return { rows };
}
