import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { BUCKET_DOCUMENTS } from "@/lib/uploads/storage";

export type LoadedCase = {
  case_id: string;
  state: string;
  outcome: string | null;
  draft_payload: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  claimed_at: string | null;
  assignee_id: string | null;
  user: {
    id: string;
    display_name: string | null;
    telegram_id: number | null;
    telegram_first_name: string | null;
    telegram_username: string | null;
    phone_number: string | null;
    verification_status: string;
  };
  passport_image_url: string | null;
  selfie_image_url: string | null;
  // QZ-6: то, что юзер сам указал в анкете — для сверки с паспортом при вводе.
  self_declared: {
    birth_date: string | null;
    gender: string | null;
    citizenship: string | null;
    birth_place: string | null;
  };
  // QZ-3: внутренние заметки модераторов по кейсу (chronological).
  notes: { id: string; body: string; author: string; created_at: string }[];
  // QZ-4: append-only таймлайн событий (claimed/released/draft_saved/decided…).
  events: {
    id: string;
    action: string;
    actor: string | null;
    payload: Record<string, unknown>;
    created_at: string;
  }[];
};

async function signedUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  const { data } = await supabaseAdmin()
    .storage.from(BUCKET_DOCUMENTS)
    .createSignedUrl(path, 300);
  return data?.signedUrl ?? null;
}

export async function loadCase(caseId: string): Promise<LoadedCase | null> {
  const { data: row } = await supabaseAdmin()
    .from("verification_cases")
    .select(
      "id, state, outcome, draft_payload, created_at, updated_at, claimed_at, assignee_id, user_id",
    )
    .eq("id", caseId)
    .maybeSingle();
  if (!row) return null;

  const { data: user } = await supabaseAdmin()
    .from("users")
    .select(
      "id, telegram_id, telegram_first_name, telegram_username, phone_number, verification_status",
    )
    .eq("id", row.user_id)
    .maybeSingle();
  if (!user) return null;

  const { data: profile } = await supabaseAdmin()
    .from("user_profiles")
    .select(
      "display_name, birth_date, gender, citizenship, birth_country, birth_region, birth_district, birth_city",
    )
    .eq("user_id", row.user_id)
    .maybeSingle();

  const { data: doc } = await supabaseAdmin()
    .from("user_documents")
    .select("passport_path, selfie_path")
    .eq("user_id", row.user_id)
    .maybeSingle();

  const [passport_image_url, selfie_image_url] = await Promise.all([
    signedUrl((doc?.passport_path as string | null) ?? null),
    signedUrl((doc?.selfie_path as string | null) ?? null),
  ]);

  // QZ-3/QZ-4: заметки + таймлайн событий + логины авторов/акторов (без embed).
  const [notesRaw, eventsRaw] = await Promise.all([
    supabaseAdmin()
      .from("case_notes")
      .select("id, author_id, body, created_at")
      .eq("case_id", caseId)
      .order("created_at", { ascending: false }),
    supabaseAdmin()
      .from("case_events")
      .select("id, actor_id, action, payload, created_at")
      .eq("case_id", caseId)
      .order("created_at", { ascending: false }),
  ]);
  const noteRows = (notesRaw.data ?? []) as Array<{
    id: string; author_id: string; body: string; created_at: string;
  }>;
  const eventRows = (eventsRaw.data ?? []) as Array<{
    id: string; actor_id: string | null; action: string;
    payload: Record<string, unknown>; created_at: string;
  }>;
  const adminIds = [
    ...new Set([
      ...noteRows.map((n) => n.author_id),
      ...eventRows.map((e) => e.actor_id).filter((x): x is string => !!x),
    ]),
  ];
  const loginById = new Map<string, string>();
  if (adminIds.length) {
    const { data: admins } = await supabaseAdmin()
      .from("admin_users")
      .select("id, login")
      .in("id", adminIds);
    for (const a of admins ?? []) loginById.set(a.id as string, a.login as string);
  }

  return {
    case_id: row.id as string,
    state: row.state as string,
    outcome: (row.outcome as string | null) ?? null,
    draft_payload: (row.draft_payload as Record<string, unknown>) ?? {},
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    claimed_at: (row.claimed_at as string | null) ?? null,
    assignee_id: (row.assignee_id as string | null) ?? null,
    user: {
      id: user.id as string,
      display_name: (profile?.display_name as string | null) ?? null,
      telegram_id: (user.telegram_id as number | null) ?? null,
      telegram_first_name:
        (user.telegram_first_name as string | null) ?? null,
      telegram_username: (user.telegram_username as string | null) ?? null,
      phone_number: (user.phone_number as string | null) ?? null,
      verification_status: user.verification_status as string,
    },
    passport_image_url,
    selfie_image_url,
    self_declared: {
      birth_date: (profile?.birth_date as string | null) ?? null,
      gender: (profile?.gender as string | null) ?? null,
      citizenship: (profile?.citizenship as string | null) ?? null,
      birth_place:
        [profile?.birth_country, profile?.birth_region, profile?.birth_district, profile?.birth_city]
          .filter((x): x is string => typeof x === "string" && x !== "")
          .join(", ") || null,
    },
    notes: noteRows.map((n) => ({
      id: n.id,
      body: n.body,
      author: loginById.get(n.author_id) ?? "—",
      created_at: n.created_at,
    })),
    events: eventRows.map((e) => ({
      id: e.id,
      action: e.action,
      actor: e.actor_id ? (loginById.get(e.actor_id) ?? "—") : null,
      payload: (e.payload as Record<string, unknown>) ?? {},
      created_at: e.created_at,
    })),
  };
}
