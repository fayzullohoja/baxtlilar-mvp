import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireActiveUser } from "@/lib/auth/active-guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getMiniProfiles } from "@/lib/profile/mini";
import { cityLabel } from "@/lib/profile/cities";
import { getUnreadTotal } from "@/lib/chat/list";
import { BottomNav } from "@/components/bottom-nav";
import { RequestActions } from "@/components/requests/request-actions";
import { MiniAppShell } from "@/components/v2/MiniAppShell";
import { Headline } from "@/components/v2/Headline";

export const dynamic = "force-dynamic";

function RequestTab({ k, label, isOut }: { k: string; label: string; isOut: boolean }) {
  const active = (k === "outgoing") === isOut;
  return (
    <Link
      href={`/requests?tab=${k}`}
      style={{
        flex: 1,
        textAlign: "center",
        padding: "9px 0",
        fontSize: "14px",
        borderRadius: 999,
        textDecoration: "none",
        fontWeight: active ? 800 : 600,
        background: active ? "var(--color-v2-accent)" : "transparent",
        color: active ? "#FFF7F0" : "var(--color-v2-ink-300)",
        boxShadow: active ? "0 4px 12px rgba(193, 54, 47, 0.22)" : "none",
        transition: "background-color 0.15s ease, color 0.15s ease",
      }}
    >
      {label}
    </Link>
  );
}

/**
 * Истёкший pending (auto_decline_at в прошлом) показываем как 'expired', хотя строка в
 * БД ещё 'pending': истечение ленивое (транзишн происходит при следующем взаимодействии
 * пары / при попытке принять). Без этого отправитель видит «Ожидает ответа» вечно.
 * Date.now() вынесен из компонента (react-hooks/purity).
 */
function effectiveStatus(r: Record<string, unknown>): string {
  const s = r.status as string;
  const dl = r.auto_decline_at as string | undefined;
  if (s === "pending" && dl && new Date(dl).getTime() <= Date.now()) return "expired";
  return s;
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
      .select("id, receiver_id, status, created_at, auto_decline_at")
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
  const unread = await getUnreadTotal(user.id);

  return (
    <>
      <MiniAppShell eyebrow="Baxtlilar" align="top" footer={null}>
        <Headline size="lg" as="h1">
          {t("title")}
        </Headline>

        <div
          style={{
            display: "flex",
            gap: 4,
            padding: 4,
            marginTop: 20,
            marginBottom: 24,
            background: "#ffffff",
            border: "1.5px solid var(--color-v2-ink-500)",
            borderRadius: 999,
            boxShadow: "var(--v2-shadow-card)",
          }}
        >
          <RequestTab k="incoming" label={t("incoming")} isOut={isOut} />
          <RequestTab k="outgoing" label={t("outgoing")} isOut={isOut} />
        </div>

        {reqs.length === 0 ? (
          <div
            style={{
              padding: "56px 0",
              textAlign: "center",
              color: "var(--color-v2-ink-400)",
              fontSize: 14,
            }}
          >
            {t("empty")}
          </div>
        ) : (
          <ul className="v2-rise" style={{ display: "flex", flexDirection: "column", gap: 10, listStyle: "none", padding: 0, margin: 0 }}>
            {reqs.map((r) => {
              const m = minis[(isOut ? r.receiver_id : r.sender_id) as string];
              return (
                <li
                  key={r.id as string}
                  style={{
                    background: "#ffffff",
                    border: "1px solid var(--color-v2-border)",
                    borderRadius: "var(--v2-radius-card)",
                    boxShadow: "var(--v2-shadow-card)",
                    padding: 14,
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <Link
                    href={`/v2/profile/${m?.id}`}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      flex: 1,
                      minWidth: 0,
                      textDecoration: "none",
                      color: "inherit",
                    }}
                  >
                    <div
                      style={{
                        width: 48,
                        height: 48,
                        flexShrink: 0,
                        borderRadius: 999,
                        overflow: "hidden",
                        background: "var(--v2-grad-brand)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {m?.photoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={m.photoUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : (
                        <span
                          aria-hidden
                          style={{
                            color: "#FFF7F0",
                            fontFamily: "var(--font-v2-display)",
                            fontWeight: 800,
                            fontSize: 20,
                          }}
                        >
                          {(m?.name ?? "").slice(0, 1)}
                        </span>
                      )}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 15,
                          fontWeight: 700,
                          color: "var(--color-v2-ink-100)",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {m?.name}
                        {m?.age ? `, ${m.age}` : ""}
                      </div>
                      <div
                        style={{
                          fontSize: 13,
                          color: "var(--color-v2-ink-400)",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {isOut
                          ? t(`status_${effectiveStatus(r)}`)
                          : (r.message as string) || cityLabel(m?.city, locale)}
                      </div>
                    </div>
                  </Link>
                  {isOut ? (
                    effectiveStatus(r) === "pending" ? (
                      <RequestActions requestId={r.id as string} kind="outgoing" />
                    ) : null
                  ) : (
                    <RequestActions requestId={r.id as string} kind="incoming" />
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <div style={{ height: 80 }} />
      </MiniAppShell>
      <BottomNav active="requests" unread={unread} />
    </>
  );
}
