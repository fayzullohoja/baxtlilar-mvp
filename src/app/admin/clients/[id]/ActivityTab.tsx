import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { unwrapCount, unwrapOne } from "@/lib/db/unwrap";
import { ADMIN } from "@/lib/admin/admin-tokens";

export async function ActivityTab({ userId }: { userId: string }) {
  const sb = supabaseAdmin();
  // chats хранит пару как (user_a < user_b); native builder без .or — считаем
  // обе стороны раздельно и складываем (юзер ровно в одной колонке на чат).
  const [user, sent, received, chatsA, chatsB] = await Promise.all([
    sb
      .from("users")
      .select("created_at, paused_at, blocked_at")
      .eq("id", userId)
      .maybeSingle(),
    sb
      .from("match_requests")
      .select("id", { count: "exact", head: true })
      .eq("sender_id", userId),
    sb
      .from("match_requests")
      .select("id", { count: "exact", head: true })
      .eq("receiver_id", userId),
    sb
      .from("chats")
      .select("id", { count: "exact", head: true })
      .eq("user_a", userId),
    sb
      .from("chats")
      .select("id", { count: "exact", head: true })
      .eq("user_b", userId),
  ]);

  // unwrapCount/unwrapOne бросают на сбое БД — иначе «0 активности»
  // неотличимо от недоступной базы.
  const chatCount = unwrapCount(chatsA) + unwrapCount(chatsB);
  const u = unwrapOne(user) as {
    created_at?: string;
    paused_at?: string | null;
    blocked_at?: string | null;
  } | null;

  return (
    <div
      style={{
        padding: 24,
        border: `1px solid ${ADMIN.border}`,
        borderRadius: 8,
        background: ADMIN.surface,
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 16,
      }}
    >
      <Stat
        label="Зарегистрирован"
        value={u?.created_at ? new Date(u.created_at).toLocaleDateString("ru-RU") : "—"}
      />
      <Stat
        label="Пауза"
        value={u?.paused_at ? new Date(u.paused_at).toLocaleString("ru-RU") : "—"}
      />
      <Stat label="Отправлено интересов" value={String(unwrapCount(sent))} />
      <Stat label="Получено интересов" value={String(unwrapCount(received))} />
      <Stat label="Активных чатов" value={String(chatCount)} />
      <Stat
        label="Заблокирован"
        value={u?.blocked_at ? new Date(u.blocked_at).toLocaleString("ru-RU") : "—"}
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div
        style={{
          fontSize: 11,
          color: ADMIN.ink500,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 14 }}>{value}</div>
    </div>
  );
}
