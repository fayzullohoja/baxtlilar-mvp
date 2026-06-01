import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireActiveUser } from "@/lib/auth/active-guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getMiniProfiles } from "@/lib/profile/mini";
import { BottomNav } from "@/components/bottom-nav";
import { RequestActions } from "@/components/requests/request-actions";

export const dynamic = "force-dynamic";

function RequestTab({ k, label, isOut }: { k: string; label: string; isOut: boolean }) {
  return (
    <Link
      href={`/requests?tab=${k}`}
      className={
        "flex-1 text-center py-2 text-sm rounded-full " +
        ((k === "outgoing") === isOut ? "bg-baxt-coral text-white" : "text-baxt-muted")
      }
    >
      {label}
    </Link>
  );
}

export default async function RequestsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { locale } = await params;
  const { tab } = await searchParams;
  setRequestLocale(locale);
  const user = await requireActiveUser(locale, { allowPaused: true });
  const t = await getTranslations("Requests");
  const sb = supabaseAdmin();
  const isOut = tab === "outgoing";

  let reqs: Record<string, unknown>[] = [];
  if (isOut) {
    const { data } = await sb
      .from("match_requests")
      .select("id, receiver_id, status, created_at")
      .eq("sender_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);
    reqs = data ?? [];
  } else {
    const { data } = await sb
      .from("match_requests")
      .select("id, sender_id, message, created_at")
      .eq("receiver_id", user.id)
      .eq("status", "pending")
      .gt("auto_decline_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(50);
    reqs = data ?? [];
  }
  const otherIds = reqs.map((r) => (isOut ? r.receiver_id : r.sender_id) as string);
  const minis = await getMiniProfiles(otherIds);

  return (
    <main className="min-h-screen pb-20 bg-baxt-pink-bg">
      <header className="px-5 pt-6 pb-3">
        <h1 className="text-2xl font-bold text-baxt-navy mb-3">{t("title")}</h1>
        <div className="flex gap-1 bg-white border border-baxt-border rounded-full p-1">
          <RequestTab k="incoming" label={t("incoming")} isOut={isOut} />
          <RequestTab k="outgoing" label={t("outgoing")} isOut={isOut} />
        </div>
      </header>

      {reqs.length === 0 ? (
        <div className="px-5 py-16 text-center text-baxt-muted text-sm">{t("empty")}</div>
      ) : (
        <ul className="px-4 space-y-2">
          {reqs.map((r) => {
            const m = minis[(isOut ? r.receiver_id : r.sender_id) as string];
            return (
              <li key={r.id as string} className="bg-white border border-baxt-border rounded-2xl p-3 flex items-center gap-3">
                <Link href={`/profile/${m?.id}`} className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-12 h-12 rounded-full bg-baxt-coral-bg overflow-hidden shrink-0">
                    {m?.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.photoUrl} alt="" className="w-full h-full object-cover" />
                    ) : null}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-baxt-navy truncate">
                      {m?.name}
                      {m?.age ? `, ${m.age}` : ""}
                    </div>
                    <div className="text-xs text-baxt-muted truncate">
                      {isOut ? t(`status_${r.status as string}`) : ((r.message as string) || m?.city)}
                    </div>
                  </div>
                </Link>
                {isOut ? (
                  r.status === "pending" ? <RequestActions requestId={r.id as string} kind="outgoing" /> : null
                ) : (
                  <RequestActions requestId={r.id as string} kind="incoming" />
                )}
              </li>
            );
          })}
        </ul>
      )}
      <BottomNav active="requests" />
    </main>
  );
}
