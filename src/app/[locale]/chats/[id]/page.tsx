import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link, redirect } from "@/i18n/navigation";
import { requireActiveUser } from "@/lib/auth/active-guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getMiniProfiles } from "@/lib/profile/mini";
import { ChatRoom, type Msg } from "@/components/chat/chat-room";

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

  return (
    <main className="mx-auto flex h-[100dvh] max-w-screen-sm flex-col overflow-hidden bg-baxt-pink-bg">
      <header className="flex shrink-0 items-center gap-2 border-b border-baxt-border bg-white px-2 py-2">
        <Link
          href="/chats"
          aria-label="Назад"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-lg text-baxt-navy hover:bg-baxt-pink-bg"
        >
          ←
        </Link>
        <Link href={`/profile/${otherId}`} className="flex min-w-0 items-center gap-2.5">
          <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-baxt-coral-bg">
            {other?.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={other.photoUrl} alt="" className="h-full w-full object-cover" />
            ) : null}
          </div>
          <span className="truncate text-sm font-semibold text-baxt-navy">{other?.name}</span>
        </Link>
      </header>

      <ChatRoom key={id} chatId={id} myId={user.id} initial={(messages ?? []) as Msg[]} safetyTip={t("safety_tip")} />
    </main>
  );
}
