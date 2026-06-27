import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { BUCKET_DOCUMENTS } from "@/lib/uploads/storage";

export type LoadedClient = {
  user: {
    id: string;
    display_name: string | null;
    avatar_path: string | null;
    avatar_url: string | null;
    verification_status: string;
    lifecycle_state: string;
    telegram_first_name: string | null;
    telegram_username: string | null;
    created_at: string;
  };
  identity: null | {
    last_name: string;
    first_name: string;
    middle_name: string | null;
    birth_date: string;
    gender: string;
    citizenship: string;
    birth_place: string;
    passport_series: string;
    passport_number: string;
    pinfl: string;
    issued_by: string;
    issued_at: string;
    expires_at: string;
    region_code: string;
    district_code: string;
    locality: string;
    street_address: string;
    entered_by: string;
    entered_at: string;
    source_case_id: string | null;
    enterer_login: string | null;
  };
};

async function signedUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  const { data } = await supabaseAdmin()
    .storage.from(BUCKET_DOCUMENTS)
    .createSignedUrl(path, 300);
  return data?.signedUrl ?? null;
}

export async function loadClient(userId: string): Promise<LoadedClient | null> {
  const { data: user } = await supabaseAdmin()
    .from("users")
    .select(
      "id, avatar_path, verification_status, lifecycle_state, telegram_first_name, telegram_username, created_at",
    )
    .eq("id", userId)
    .maybeSingle();
  if (!user) return null;

  const { data: profile } = await supabaseAdmin()
    .from("user_profiles")
    .select("display_name")
    .eq("user_id", userId)
    .maybeSingle();

  const avatar_url = await signedUrl((user.avatar_path as string | null) ?? null);

  const { data: idRow } = await supabaseAdmin()
    .from("user_identity")
    .select(
      "last_name, first_name, middle_name, birth_date, gender, citizenship, birth_place, passport_series, passport_number, pinfl, issued_by, issued_at, expires_at, region_code, district_code, locality, street_address, entered_by, entered_at, source_case_id",
    )
    .eq("user_id", userId)
    .is("superseded_at", null)
    .maybeSingle();

  let identity: LoadedClient["identity"] = null;
  if (idRow) {
    const { data: enterer } = await supabaseAdmin()
      .from("admin_users")
      .select("login")
      .eq("id", idRow.entered_by as string)
      .maybeSingle();

    identity = {
      last_name: idRow.last_name as string,
      first_name: idRow.first_name as string,
      middle_name: (idRow.middle_name as string | null) ?? null,
      birth_date: idRow.birth_date as string,
      gender: idRow.gender as string,
      citizenship: idRow.citizenship as string,
      birth_place: idRow.birth_place as string,
      passport_series: idRow.passport_series as string,
      passport_number: idRow.passport_number as string,
      pinfl: idRow.pinfl as string,
      issued_by: idRow.issued_by as string,
      issued_at: idRow.issued_at as string,
      expires_at: idRow.expires_at as string,
      region_code: idRow.region_code as string,
      district_code: idRow.district_code as string,
      locality: idRow.locality as string,
      street_address: idRow.street_address as string,
      entered_by: idRow.entered_by as string,
      entered_at: idRow.entered_at as string,
      source_case_id: (idRow.source_case_id as string | null) ?? null,
      enterer_login: (enterer?.login as string | null) ?? null,
    };
  }

  return {
    user: {
      id: user.id as string,
      display_name: (profile?.display_name as string | null) ?? null,
      avatar_path: (user.avatar_path as string | null) ?? null,
      avatar_url,
      verification_status: user.verification_status as string,
      lifecycle_state: user.lifecycle_state as string,
      telegram_first_name:
        (user.telegram_first_name as string | null) ?? null,
      telegram_username: (user.telegram_username as string | null) ?? null,
      created_at: user.created_at as string,
    },
    identity,
  };
}
