import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link, redirect } from "@/i18n/navigation";
import { requireActiveUser } from "@/lib/auth/active-guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getMiniProfiles } from "@/lib/profile/mini";
import { MessageForm } from "@/components/chat/message-form";

export const dynamic = "force-dynamic";

export default async function ChatThread({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const user = await requireActiveUser(locale, { allowPaused: true });
  const t = await getTranslations("Chat");
  const sb = supabaseAdmin();

  const { data: chat } = await sb.from("chats").select("id, user_a, user_b").eq("id", id).maybeSingle();
  if (!chat || (chat.user_a !== user.id && chat.user_b !== user.id)) redirect({ href: "/chats", locale });

  const otherId = chat!.user_a === user.id ? (chat!.user_b as string) : (chat!.user_a as string);
  const minis = await getMiniProfiles([otherId]);
  const other = minis[otherId];

  const { data: messages } = await sb
    .from("chat_messages")
    .select("id, sender_id, body, created_at")
    .eq("chat_id", id)
    .order("created_at", { ascending: true })
    .limit(200);
  const msgs = messages ?? [];

  return (
    <main className="min-h-screen pb-24 bg-baxt-pink-bg">
      <header className="sticky top-0 bg-white border-b border-baxt-border px-4 py-3 flex items-center gap-3 z-10">
        <Link href="/chats" className="text-baxt-muted">←</Link>
        <Link href={`/profile/${otherId}`} className="flex items-center gap-2 min-w-0">
          <div className="w-9 h-9 rounded-full bg-baxt-coral-bg overflow-hidden shrink-0">
            {other?.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={other.photoUrl} alt="" className="w-full h-full object-cover" />
            ) : null}
          </div>
          <span className="text-sm font-medium text-baxt-navy truncate">{other?.name}</span>
        </Link>
      </header>

      <div className="px-4 py-4 space-y-2">
        {msgs.length === 0 ? (
          <div className="rounded-2xl bg-baxt-coral-bg px-4 py-3 text-xs text-baxt-navy text-center mb-2">
            {t("safety_tip")}
          </div>
        ) : null}
        {msgs.map((m) => {
          const mine = m.sender_id === user.id;
          return (
            <div key={m.id as string} className={mine ? "flex justify-end" : "flex justify-start"}>
              <div
                className={
                  "max-w-[75%] rounded-2xl px-3.5 py-2 text-sm " +
                  (mine ? "bg-baxt-coral text-white" : "bg-white border border-baxt-border text-baxt-navy")
                }
              >
                {m.body as string}
              </div>
            </div>
          );
        })}
      </div>

      <MessageForm chatId={id} />
    </main>
  );
}
