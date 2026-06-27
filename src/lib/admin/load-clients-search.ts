import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { signedDocumentUrls } from "@/lib/uploads/storage";
import { unwrapRows } from "@/lib/db/unwrap";
import { ageFromDate } from "@/lib/profile/schemas";

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

/**
 * Поиск клиентов для /admin/clients. Матчинг живёт в RPC admin_search_clients
 * (ПИНФЛ/паспорт/@username/телефон/ФИО через pg_trgm) — она возвращает
 * ранжированный массив user_id; здесь дотягиваем строки и сшиваем, СОХРАНЯЯ
 * порядок релевантности.
 *
 * Пустой q → последние зарегистрированные (директория показывает их по
 * умолчанию). Это намеренная верхняя граница, не пагинация — см. note в UI.
 *
 * RPC зависит от pg_trgm extension + индексов (миграции 100500/110000); её сбой
 * поднимается явно, а не маскируется пустой директорией.
 */
export type ClientFilters = { status?: string; gender?: string };

export async function searchClients(
  q: string,
  limit = 50,
  filters?: ClientFilters,
): Promise<{ rows: ClientRow[] }> {
  const sb = supabaseAdmin();
  const statusF = filters?.status && filters.status !== "all" ? filters.status : null;
  const genderF =
    filters?.gender === "m" || filters?.gender === "f" ? filters.gender : null;

  let ids: string[];
  if (q.trim() === "" && (statusF || genderF)) {
    // Просмотр с фильтрами (как было в /admin/users): запрос users напрямую,
    // RPC поиска не нужен. pg_trgm-поиск (по q) фильтры не применяет.
    let genderIds: string[] | null = null;
    if (genderF) {
      genderIds = unwrapRows(
        await sb.from("user_profiles").select("user_id").eq("gender", genderF),
      ).map((r) => r.user_id as string);
      if (genderIds.length === 0) return { rows: [] };
    }
    let uq = sb
      .from("users")
      .select("id")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (statusF) uq = uq.eq("lifecycle_state", statusF);
    if (genderIds) uq = uq.in("id", genderIds);
    ids = unwrapRows(await uq).map((r) => r.id as string);
  } else {
    const { data: rpcData, error: rpcErr } = await sb.rpc(
      "admin_search_clients",
      { p_q: q ?? "", p_limit: limit },
    );
    if (rpcErr) {
      throw new Error(`admin_search_clients failed: ${rpcErr.message}`);
    }
    ids = Array.isArray(rpcData) ? (rpcData as string[]) : [];
  }
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
  const users = unwrapRows(usersRes);
  const profiles = unwrapRows(profilesRes);
  const idents = unwrapRows(identsRes);

  const userById = new Map(users.map((u) => [u.id as string, u]));
  const profById = new Map(profiles.map((p) => [p.user_id as string, p]));
  const identById = new Map(idents.map((i) => [i.user_id as string, i]));
  const avatarUrlByPath = await signedDocumentUrls(
    users.map((u) => u.avatar_path as string | null),
  );

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
      age: bd ? ageFromDate(bd) : null,
      city: (p?.city as string | null) ?? null,
      pinfl: (i?.pinfl as string | null) ?? null,
      passport: i ? `${i.passport_series}${i.passport_number}` : null,
      telegram_username: (u.telegram_username as string | null) ?? null,
      phone_number_masked: u.phone_number
        ? maskPhone(u.phone_number as string)
        : null,
      verification_status: u.verification_status as string,
      lifecycle_state: u.lifecycle_state as string,
      avatar_url: avatarPath ? (avatarUrlByPath[avatarPath] ?? null) : null,
      created_at: u.created_at as string,
    });
  }
  return { rows };
}
