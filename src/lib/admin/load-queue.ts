import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { unwrapRows } from "@/lib/db/unwrap";

export type QueueCase = {
  case_id: string;
  user_id: string;
  state: string;
  display_name: string | null;
  telegram_first_name: string | null;
  telegram_username: string | null;
  created_at: string;
  updated_at: string;
};

type RawRow = {
  id: string;
  user_id: string;
  state: string;
  created_at: string;
  updated_at: string;
  users:
    | {
        telegram_first_name: string | null;
        telegram_username: string | null;
      }
    | null;
  user_profiles?: { display_name: string | null } | null;
};

function shape(r: RawRow): QueueCase {
  return {
    case_id: r.id,
    user_id: r.user_id,
    state: r.state,
    display_name: r.user_profiles?.display_name ?? null,
    telegram_first_name: r.users?.telegram_first_name ?? null,
    telegram_username: r.users?.telegram_username ?? null,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

// Без embed: native query-builder НЕ умеет `users!fk(...)` — кидает loud throw
// (был 500 на /admin/queue/mine). Тянем связанные строки отдельными .in-запросами
// и сшиваем в JS (см. baxtlilar-db-error-discipline).
const SELECT_COLS = "id, user_id, state, created_at, updated_at";

async function attachRelated(rows: RawRow[]): Promise<RawRow[]> {
  if (rows.length === 0) return rows;
  const userIds = Array.from(new Set(rows.map((r) => r.user_id)));
  const [profilesRes, usersRes] = await Promise.all([
    supabaseAdmin()
      .from("user_profiles")
      .select("user_id, display_name")
      .in("user_id", userIds),
    supabaseAdmin()
      .from("users")
      .select("id, telegram_first_name, telegram_username")
      .in("id", userIds),
  ]);
  const displayByUser = new Map(
    unwrapRows(profilesRes).map((p) => [
      p.user_id as string,
      (p.display_name as string | null) ?? null,
    ]),
  );
  const userById = new Map(
    unwrapRows(usersRes).map((u) => [u.id as string, u]),
  );
  return rows.map((r) => {
    const u = userById.get(r.user_id);
    return {
      ...r,
      user_profiles: { display_name: displayByUser.get(r.user_id) ?? null },
      users: u
        ? {
            telegram_first_name: (u.telegram_first_name as string | null) ?? null,
            telegram_username: (u.telegram_username as string | null) ?? null,
          }
        : null,
    };
  });
}

export async function loadMyQueue(
  adminId: string,
  limit = 50,
): Promise<QueueCase[]> {
  const rows = unwrapRows(
    await supabaseAdmin()
      .from("verification_cases")
      .select(SELECT_COLS)
      .eq("assignee_id", adminId)
      .neq("state", "closed")
      .order("created_at", { ascending: true })
      .limit(limit),
  ) as RawRow[];
  return (await attachRelated(rows)).map(shape);
}

export async function loadUnassignedQueue(limit = 50): Promise<QueueCase[]> {
  const rows = unwrapRows(
    await supabaseAdmin()
      .from("verification_cases")
      .select(SELECT_COLS)
      .is("assignee_id", null)
      .eq("state", "new")
      .order("created_at", { ascending: true })
      .limit(limit),
  ) as RawRow[];
  return (await attachRelated(rows)).map(shape);
}
