import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireActiveUser } from "@/lib/auth/active-guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getMiniProfiles } from "@/lib/profile/mini";
import { BottomNav } from "@/components/bottom-nav";

export const dynamic = "force-dynamic";

export default async function ChatsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireActiveUser(locale, { allowPaused: true });
  const t = await getTranslations("Chat");
  const sb = supabaseAdmin();

  const { data: chats } = await sb
    .from("chats")
    .select("id, user_a, user_b, last_message_at")
    .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(50);
  const list = chats ?? [];
  const otherIds = list.map((c) => (c.user_a === user.id ? (c.user_b as string) : (c.user_a as string)));
  const minis = await getMiniProfiles(otherIds);

  // последнее сообщение + непрочитанные одним запросом
  const ids = list.map((c) => c.id as string);
  const lastBy: Record<string, string> = {};
  const unreadBy: Record<string, number> = {};
  if (ids.length) {
    const { data: msgs } = await sb
      .from("chat_messages")
      .select("chat_id, body, sender_id, read_at, created_at")
      .in("chat_id", ids)
      .order("created_at", { ascending: false });
    for (const m of msgs ?? []) {
      const cid = m.chat_id as string;
      if (!(cid in lastBy)) lastBy[cid] = m.body as string;
      if (m.sender_id !== user.id && !m.read_at) unreadBy[cid] = (unreadBy[cid] ?? 0) + 1;
    }
  }

  return (
    <main className="min-h-screen pb-20 bg-baxt-pink-bg">
      <header className="px-5 pt-6 pb-3">
        <h1 className="text-2xl font-bold text-baxt-navy">{t("title")}</h1>
      </header>
      {list.length === 0 ? (
        <div className="px-5 py-16 text-center text-baxt-muted text-sm">{t("empty")}</div>
      ) : (
        <ul className="px-4 space-y-2">
          {list.map((c) => {
            const otherId = c.user_a === user.id ? (c.user_b as string) : (c.user_a as string);
            const m = minis[otherId];
            const unread = unreadBy[c.id as string] ?? 0;
            return (
              <li key={c.id as string}>
                <Link href={`/chats/${c.id}`} className="flex items-center gap-3 bg-white border border-baxt-border rounded-2xl p-3">
                  <div className="w-12 h-12 rounded-full bg-baxt-coral-bg overflow-hidden shrink-0">
                    {m?.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.photoUrl} alt="" className="w-full h-full object-cover" />
                    ) : null}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-baxt-navy">{m?.name}</div>
                    <div className="text-xs text-baxt-muted truncate">{lastBy[c.id as string] ?? t("no_messages")}</div>
                  </div>
                  {unread > 0 ? (
                    <span className="bg-baxt-coral text-white text-[11px] rounded-full min-w-5 h-5 px-1.5 flex items-center justify-center">
                      {unread}
                    </span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      <BottomNav active="chats" />
    </main>
  );
}
