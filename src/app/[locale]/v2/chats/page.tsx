/**
 * V2 Chat List (Blueprint §3.4 C5).
 *
 * Editorial-list существующих чатов. Без аватаров-кружков из ленты —
 * вместо них inline-инициал в круге paper цвета. Без баджей-номеров на
 * каждой строке — только тонкий dot если unread.
 */

import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireActiveUser } from "@/lib/auth/active-guard";
import { getChatList } from "@/lib/chat/list";
import { BottomNav } from "@/components/bottom-nav";
import { AutoRefresh } from "@/components/auto-refresh";
import { MiniAppShell } from "@/components/v2/MiniAppShell";
import { Headline, Lead } from "@/components/v2/Headline";

export const dynamic = "force-dynamic";

const TZ = "Asia/Tashkent";

function chatTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const sameDay =
    d.toLocaleDateString("ru-RU", { timeZone: TZ }) ===
    now.toLocaleDateString("ru-RU", { timeZone: TZ });
  return sameDay
    ? d.toLocaleTimeString("ru-RU", { timeZone: TZ, hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("ru-RU", { timeZone: TZ, day: "2-digit", month: "2-digit" });
}

function firstWord(s: string): string {
  return s.trim().split(/\s+/)[0] ?? s;
}

export default async function V2ChatsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireActiveUser(locale, { allowPaused: true });
  const rows = await getChatList(user.id);
  const totalUnread = rows.reduce((s, r) => s + r.unread, 0);

  return (
    <>
      <AutoRefresh />
      <MiniAppShell eyebrow="Чаты" align="top" footer={null}>
        {rows.length === 0 ? (
          <div style={{ marginTop: "60px" }}>
            <Headline size="md" as="h1">
              Пока никто не&nbsp;ответил взаимностью.
            </Headline>
            <Lead>
              Чаты открываются только после взаимного интереса. Это нормально, что
              их сначала ноль — мы здесь не для миллиона совпадений.
            </Lead>
          </div>
        ) : (
          <>
            <Headline size="lg" as="h1">
              Открытые чаты.
            </Headline>
            <Lead>
              Каждая строка — взаимный интерес. Открой и&nbsp;продолжи разговор.
            </Lead>

            <ul style={{ listStyle: "none", padding: 0, marginTop: "32px" }}>
              {rows.map((r) => {
                const name = firstWord(r.name);
                const initial = name[0] ?? "?";
                const hasUnread = r.unread > 0;
                return (
                  <li
                    key={r.chatId}
                    style={{
                      borderTop: "1px solid var(--color-v2-ink-500)",
                    }}
                  >
                    <Link
                      href={`/v2/chats/${r.chatId}`}
                      style={{
                        display: "flex",
                        gap: "16px",
                        padding: "20px 0",
                        textDecoration: "none",
                        alignItems: "center",
                        color: "inherit",
                      }}
                    >
                      <div
                        style={{
                          width: "44px",
                          height: "44px",
                          borderRadius: "50%",
                          background: "transparent",
                          border: "1px solid var(--color-v2-ink-300)",
                          display: "grid",
                          placeItems: "center",
                          fontFamily: "var(--font-v2-display)",
                          fontSize: "16px",
                          color: "var(--color-v2-ink-200)",
                          flexShrink: 0,
                        }}
                      >
                        {initial.toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0, fontFamily: "var(--font-v2-body)" }}>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "baseline",
                            gap: "8px",
                            marginBottom: "4px",
                          }}
                        >
                          <span
                            style={{
                              fontSize: "16px",
                              color: "var(--color-v2-ink-100)",
                              fontWeight: hasUnread ? 600 : 500,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {name}
                          </span>
                          <span
                            style={{
                              fontSize: "11px",
                              color: "var(--color-v2-ink-400)",
                              flexShrink: 0,
                            }}
                          >
                            {chatTime(r.lastAt)}
                          </span>
                        </div>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                          }}
                        >
                          {hasUnread ? (
                            <span
                              style={{
                                width: "6px",
                                height: "6px",
                                borderRadius: "50%",
                                background: "var(--color-v2-ink-100)",
                                flexShrink: 0,
                              }}
                            />
                          ) : null}
                          <span
                            style={{
                              fontSize: "13px",
                              color: hasUnread
                                ? "var(--color-v2-ink-200)"
                                : "var(--color-v2-ink-400)",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {r.lastBody
                              ? (r.mine ? "Вы: " : "") + r.lastBody
                              : "Нет сообщений"}
                          </span>
                        </div>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </MiniAppShell>
      <BottomNav active="chats" unread={totalUnread} />
    </>
  );
}
