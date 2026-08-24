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
 * Поиск клиентов для /admin/clients. Матчинг И фильтры И пагинация живут в RPC
 * admin_search_clients (ПИНФЛ/паспорт/@username/телефон/ФИО через pg_trgm; фильтры
 * status/gender/verification/deleted и offset/limit — на стороне БД). Она
 * возвращает ранжированный массив user_id; здесь дотягиваем строки и сшиваем,
 * СОХРАНЯЯ порядок релевантности.
 *
 * Волна 4: раньше фильтры применялись в JS по уже-урезанным строкам (неполнота
 * на 10k) и терялись при непустом q. Теперь всё в RPC → поиск+фильтр компонуются,
 * страницы режутся в БД. hasMore считаем по limit+1 (как loadPhotosQueue).
 *
 * RPC зависит от pg_trgm extension + индексов; её сбой поднимается явно, а не
 * маскируется пустой директорией.
 */
export type ClientFilters = {
  status?: string; // lifecycle_state | 'deleted' | 'all'
  gender?: string; // 'm' | 'f' | 'all'
  verification?: string; // verification_status | 'all'
};

export async function searchClients(
  q: string,
  limit = 50,
  filters?: ClientFilters,
  offset = 0,
): Promise<{ rows: ClientRow[]; hasMore: boolean }> {
  const sb = supabaseAdmin();
  const norm = (v?: string) => (v && v !== "all" ? v : null);
  const statusF = norm(filters?.status);
  const genderF =
    filters?.gender === "m" || filters?.gender === "f" ? filters.gender : null;
  const verifF = norm(filters?.verification);

  // limit+1 — чтобы узнать hasMore, не делая второй запрос.
  const { data: rpcData, error: rpcErr } = await sb.rpc("admin_search_clients", {
    p_q: q ?? "",
    p_limit: limit + 1,
    p_offset: Math.max(offset, 0),
    p_status: statusF,
    p_gender: genderF,
    p_verification: verifF,
  });
  if (rpcErr) {
    throw new Error(`admin_search_clients failed: ${rpcErr.message}`);
  }
  const allIds = Array.isArray(rpcData) ? (rpcData as string[]) : [];
  const hasMore = allIds.length > limit;
  const ids = hasMore ? allIds.slice(0, limit) : allIds;
  if (ids.length === 0) return { rows: [], hasMore: false };

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
      // Серию и номер паспорта здесь НЕ читаем: директория их нигде не рисует
      // (ClientsTable показывает ФИО, ПИНФЛ, замаскированный телефон, город),
      // а строки уезжают в браузер целиком - полсотни паспортов за раз и заново
      // на каждый набранный в поиске символ. ПИНФЛ оставлен намеренно: он в
      // таблице отображается, доступ к директории только у суперадмина.
      // Полные паспортные данные открываются в карточке человека - там они
      // нужны и там их видно осознанно.
      .select("user_id, last_name, first_name, middle_name, pinfl, birth_date")
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
  return { rows, hasMore };
}
