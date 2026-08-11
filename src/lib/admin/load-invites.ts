import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { unwrapRows } from "@/lib/db/unwrap";

export type InviteRow = {
  id: string;
  code: string;
  owner_id: string | null;
  // Человекочитаемое имя владельца (ФИО из анкеты -> имя из Telegram ->
  // @username) - null у мастер-кода (owner_id пуст). "Login" в названии поля
  // API - по брифу Task 10, по смыслу это скорее "чей код"/"кто владелец".
  owner_login: string | null;
  // Персональный запрет владельца приглашать (users.invite_revoked_at,
  // Task 10) - показываем, чтобы модератор видел ИСТОЧНИК истины напрямую, а
  // не только следствие (disabled_at строки). У мастер-кода - всегда false.
  owner_invite_revoked: boolean;
  label: string | null;
  invited: number;
  disabled_at: string | null;
  disabled_reason: string | null;
  created_at: string;
};

/**
 * Список всех кодов-приглашений для /admin/invites - рабочий инструмент
 * модератора: видно, кто кого привёл, чей код погашен и почему, есть ли у
 * человека персональный запрет.
 *
 * "Привёл" считаем ПО КОНКРЕТНОЙ СТРОКЕ КОДА (users.invite_code_id), а НЕ по
 * владельцу (users.invited_by, как в countInvitedBy для карточки клиента): у
 * человека за время жизни аккаунта может смениться несколько строк
 * invite_codes (старая погашена, новая выпущена ensureCodeForUser) - per-код
 * счётчик честно показывает, кого привёл ИМЕННО этот код. Суммарная цифра по
 * человеку - отдельная (countInvitedBy), она уже в карточке клиента
 * (src/lib/admin/load-invite-summary.ts) и намеренно НЕ дублируется здесь.
 *
 * Батч-запросы вместо N+1: одним select тянем всех владельцев из ids кодов,
 * одним select - все invite_code_id по всем пользователям сразу и считаем в
 * JS (по образцу searchClients в load-clients-search.ts).
 */
export async function loadInviteRows(): Promise<InviteRow[]> {
  const sb = supabaseAdmin();
  const codes = unwrapRows(
    await sb
      .from("invite_codes")
      .select("id, code, owner_id, label, disabled_at, disabled_reason, created_at")
      .order("created_at", { ascending: false }),
  );

  const ownerIds = [
    ...new Set(codes.map((c) => c.owner_id as string | null).filter((v): v is string => !!v)),
  ];

  const ownerLogin = new Map<string, string | null>();
  const ownerRevoked = new Map<string, boolean>();
  if (ownerIds.length) {
    const [usersRes, profilesRes] = await Promise.all([
      sb
        .from("users")
        .select("id, telegram_username, telegram_first_name, invite_revoked_at")
        .in("id", ownerIds),
      sb.from("user_profiles").select("user_id, display_name").in("user_id", ownerIds),
    ]);
    const users = unwrapRows(usersRes);
    const profiles = unwrapRows(profilesRes);
    const nameByUser = new Map(profiles.map((p) => [p.user_id as string, p.display_name as string | null]));
    for (const u of users) {
      const id = u.id as string;
      const name =
        nameByUser.get(id) ??
        (u.telegram_first_name as string | null) ??
        (u.telegram_username ? `@${u.telegram_username as string}` : null);
      ownerLogin.set(id, name ?? null);
      ownerRevoked.set(id, !!u.invite_revoked_at);
    }
  }

  const invitedRows = unwrapRows(
    await sb
      .from("users")
      .select("invite_code_id")
      .not("invite_code_id", "is", null)
      .is("deleted_at", null),
  );
  const invitedByCode = new Map<string, number>();
  for (const r of invitedRows) {
    const cid = r.invite_code_id as string;
    invitedByCode.set(cid, (invitedByCode.get(cid) ?? 0) + 1);
  }

  return codes.map((c) => {
    const ownerId = c.owner_id as string | null;
    return {
      id: c.id as string,
      code: c.code as string,
      owner_id: ownerId,
      owner_login: ownerId ? (ownerLogin.get(ownerId) ?? null) : null,
      owner_invite_revoked: ownerId ? (ownerRevoked.get(ownerId) ?? false) : false,
      label: c.label as string | null,
      invited: invitedByCode.get(c.id as string) ?? 0,
      disabled_at: c.disabled_at as string | null,
      disabled_reason: c.disabled_reason as string | null,
      created_at: c.created_at as string,
    };
  });
}
