import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireActiveUser } from "@/lib/auth/active-guard";
import { getChatList } from "@/lib/chat/list";
import { BottomNav } from "@/components/bottom-nav";
import { AutoRefresh } from "@/components/auto-refresh";

export const dynamic = "force-dynamic";

const TZ = "Asia/Tashkent";

/** Время последнего сообщения: сегодня → ЧЧ:ММ, иначе ДД.ММ (по времени Узбекистана). */
function chatTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const sameDay =
    d.toLocaleDateString("ru-RU", { timeZone: TZ }) === now.toLocaleDateString("ru-RU", { timeZone: TZ });
  return sameDay
    ? d.toLocaleTimeString("ru-RU", { timeZone: TZ, hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("ru-RU", { timeZone: TZ, day: "2-digit", month: "2-digit" });
}

export default async function ChatsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireActiveUser(locale, { allowPaused: true });
  const t = await getTranslations("Chat");

  const rows = await getChatList(user.id);
  const totalUnread = rows.reduce((s, r) => s + r.unread, 0);

  return (
    <main className="mx-auto min-h-screen max-w-screen-sm bg-baxt-pink-bg pb-20">
      <AutoRefresh />
      <header className="px-5 pb-3 pt-6">
        <h1 className="text-2xl font-bold text-baxt-navy">{t("title")}</h1>
      </header>

      {rows.length === 0 ? (
        <div className="px-5 py-16 text-center text-sm text-baxt-muted">{t("empty")}</div>
      ) : (
        <ul className="space-y-2 px-4">
          {rows.map((r) => (
            <li key={r.chatId}>
              <Link
                href={`/chats/${r.chatId}`}
                className="flex items-center gap-3 rounded-2xl border border-baxt-border bg-white p-3"
              >
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full bg-baxt-coral-bg">
                  {r.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.photoUrl} alt="" className="h-full w-full object-cover" />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-baxt-navy">{r.name}</span>
                    <span className="shrink-0 text-[11px] text-baxt-muted">{chatTime(r.lastAt)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={
                        "truncate text-xs " + (r.unread > 0 ? "font-medium text-baxt-navy" : "text-baxt-muted")
                      }
                    >
                      {r.lastBody ? (r.mine ? "Вы: " : "") + r.lastBody : t("no_messages")}
                    </span>
                    {r.unread > 0 ? (
                      <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-baxt-coral px-1.5 text-[11px] text-white">
                        {r.unread > 99 ? "99+" : r.unread}
                      </span>
                    ) : null}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <BottomNav active="chats" unread={totalUnread} />
    </main>
  );
}
