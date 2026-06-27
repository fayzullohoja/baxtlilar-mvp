import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";

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

const SELECT_COLS = `
  id, user_id, state, created_at, updated_at,
  users!verification_cases_user_id_fkey(telegram_first_name, telegram_username)
`;

async function attachProfiles(rows: RawRow[]): Promise<RawRow[]> {
  if (rows.length === 0) return rows;
  const userIds = rows.map((r) => r.user_id);
  const { data: profiles } = await supabaseAdmin()
    .from("user_profiles")
    .select("user_id, display_name")
    .in("user_id", userIds);
  const byUser = new Map(
    (profiles ?? []).map((p) => [p.user_id as string, p.display_name as string | null]),
  );
  return rows.map((r) => ({
    ...r,
    user_profiles: { display_name: byUser.get(r.user_id) ?? null },
  }));
}

export async function loadMyQueue(
  adminId: string,
  limit = 50,
): Promise<QueueCase[]> {
  const { data: rows } = await supabaseAdmin()
    .from("verification_cases")
    .select(SELECT_COLS)
    .eq("assignee_id", adminId)
    .neq("state", "closed")
    .order("created_at", { ascending: true })
    .limit(limit);
  const withProfiles = await attachProfiles((rows ?? []) as RawRow[]);
  return withProfiles.map(shape);
}

export async function loadUnassignedQueue(limit = 50): Promise<QueueCase[]> {
  const { data: rows } = await supabaseAdmin()
    .from("verification_cases")
    .select(SELECT_COLS)
    .is("assignee_id", null)
    .eq("state", "new")
    .order("created_at", { ascending: true })
    .limit(limit);
  const withProfiles = await attachProfiles((rows ?? []) as RawRow[]);
  return withProfiles.map(shape);
}
