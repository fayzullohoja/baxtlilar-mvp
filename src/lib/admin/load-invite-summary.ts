import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { countInvitedBy } from "@/lib/invite/store";

export type InviteSummary = {
  // Текст для строки "Пришёл по коду" - null, если показывать нечего (обычная
  // история почти для всех, кто зарегистрировался ДО включения шлагбаума -
  // см. invite_exempt в миграции 20260811120000).
  joinedVia: string | null;
  invitedCount: number;
};

/**
 * Инвайт-сводка для карточки клиента (Task 10) - "Пришёл по коду X от Имя" +
 * "Привёл: N".
 *
 * Полная картина (сам код + имя пригласившего) видна ТОЛЬКО здесь, в админке.
 * Мини-апп (GET /api/invite) отдаёт человеку про самого себя только ЧИСЛО
 * приглашённых - показывать третьему лицу имена раскрыло бы факт поиска брака
 * без согласия этого человека (см. комментарий в src/app/api/invite/route.ts).
 * Модератору для разбора инцидентов (утечка кода, спор о том, кто кого привёл)
 * нужна именно полная картина - отсюда разница в объёме данных между двумя
 * поверхностями одной и той же функциональности.
 */
export async function loadInviteSummary(userId: string): Promise<InviteSummary> {
  const sb = supabaseAdmin();
  const { data: person } = await sb
    .from("users")
    .select("invited_by, invite_code_id, invite_exempt")
    .eq("id", userId)
    .maybeSingle();

  const invitedCount = await countInvitedBy(userId);

  if (!person) return { joinedVia: null, invitedCount };
  if (person.invite_exempt) {
    return { joinedVia: "вошёл до запуска шлагбаума - шаг кода не проходил", invitedCount };
  }

  const inviteCodeId = person.invite_code_id as string | null;
  const invitedBy = person.invited_by as string | null;
  if (!inviteCodeId) return { joinedVia: null, invitedCount };

  const [{ data: codeRow }, { data: inviterProfile }, { data: inviterUser }] = await Promise.all([
    sb.from("invite_codes").select("code, label").eq("id", inviteCodeId).maybeSingle(),
    invitedBy
      ? sb.from("user_profiles").select("display_name").eq("user_id", invitedBy).maybeSingle()
      : Promise.resolve({ data: null }),
    invitedBy
      ? sb.from("users").select("telegram_first_name, telegram_username").eq("id", invitedBy).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const code = (codeRow?.code as string | undefined) ?? "—";

  if (!invitedBy) {
    // invited_by пуст, а invite_code_id заполнен - мастер-код (см. redeemCode,
    // src/lib/invite/gate.ts: "invited_by: row.owner_id", у мастер-кода owner_id
    // null). label объясняет происхождение - это и есть его единственная задача.
    const label = codeRow?.label as string | null | undefined;
    return { joinedVia: `${code} - мастер-код${label ? ` («${label}»)` : ""}`, invitedCount };
  }

  const inviterName =
    (inviterProfile?.display_name as string | null) ??
    (inviterUser?.telegram_first_name as string | null) ??
    (inviterUser?.telegram_username ? `@${inviterUser.telegram_username as string}` : null) ??
    "неизвестно";
  return { joinedVia: `${code} · от ${inviterName}`, invitedCount };
}
