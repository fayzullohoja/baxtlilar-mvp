/**
 * V2 Chat Detail (Blueprint §3.4 C6).
 *
 * Editorial chat: header с именем и safety menu, message thread,
 * composer. Логика SSE/poll/optimistic — те же что V1.
 *
 * Safety:
 *   - chat row отсутствует или не моя → /v2/chats
 *   - block в любую сторону → /v2/chats
 *   - собеседник deleted/blocked → «призрак»-экран без композера (E2).
 *     paused собеседник — ОК, он может отвечать в существующих чатах.
 */

import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link, redirect } from "@/i18n/navigation";
import { requireActiveUser } from "@/lib/auth/active-guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getMiniProfiles } from "@/lib/profile/mini";
import { areBlocked } from "@/lib/safety/blocks";
import { V2ChatRoom, type Msg } from "@/components/v2/ChatRoom";
import { ProfileSafetyActions } from "@/components/v2/ProfileSafetyActions";

export const dynamic = "force-dynamic";

function firstWord(s: string): string {
  return s.trim().split(/\s+/)[0] ?? s;
}

export default async function V2ChatThreadPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('Chat');
  const user = await requireActiveUser(locale, { allowPaused: true });
  const sb = supabaseAdmin();

  const { data: chat } = await sb
    .from("chats")
    .select("id, user_a, user_b")
    .eq("id", id)
    .maybeSingle();
  if (!chat || (chat.user_a !== user.id && chat.user_b !== user.id)) {
    redirect({ href: "/v2/chats", locale });
  }
  const otherId =
    chat!.user_a === user.id ? (chat!.user_b as string) : (chat!.user_a as string);

  if (await areBlocked(user.id, otherId)) {
    redirect({ href: "/v2/chats", locale });
  }

  // E2: собеседник удалил аккаунт или забанен → «призрак»-чат. Раньше код пускал
  // в тред (composer работал) — юзер писал в пустоту без всякого сигнала. paused
  // НЕ ghost: на паузе можно отвечать в существующих чатах.
  const { data: otherUser } = await sb
    .from("users")
    .select("lifecycle_state")
    .eq("id", otherId)
    .maybeSingle();
  if (!otherUser || otherUser.lifecycle_state === "deleted" || otherUser.lifecycle_state === "blocked") {
    return <GhostChat />;
  }

  const minis = await getMiniProfiles([otherId]);
  const other = minis[otherId];
  const otherName = firstWord(other?.name ?? "?");

  const { data: recent } = await sb
    .from("chat_messages")
    .select("id, sender_id, body, created_at")
    .eq("chat_id", id)
    .order("created_at", { ascending: false })
    .limit(200);
  const messages = ((recent ?? []) as Msg[]).reverse();

  return (
    <main
      style={{
        height: "100dvh",
        display: "flex",
        flexDirection: "column",
        maxWidth: "var(--v2-max-width)",
        margin: "0 auto",
        background: "var(--color-v2-paper)",
        overflow: "hidden",
        fontFamily: "var(--font-v2-body)",
      }}
    >
      <header
        style={{
          flexShrink: 0,
          padding: "14px 20px",
          borderBottom: "1px solid var(--color-v2-ink-500)",
          display: "flex",
          alignItems: "center",
          gap: "12px",
          background: "var(--color-v2-paper)",
        }}
      >
        <Link
          href="/v2/chats"
          style={{
            display: "grid",
            placeItems: "center",
            width: "32px",
            height: "32px",
            fontSize: "20px",
            color: "var(--color-v2-ink-200)",
            textDecoration: "none",
            flexShrink: 0,
          }}
          aria-label={t('placeholder')}
        >
          ←
        </Link>
        <Link
          href={`/v2/profile/${otherId}`}
          style={{
            flex: 1,
            minWidth: 0,
            textDecoration: "none",
            color: "inherit",
            display: "flex",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <div
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "50%",
              border: "1px solid var(--color-v2-ink-300)",
              display: "grid",
              placeItems: "center",
              fontFamily: "var(--font-v2-display)",
              fontSize: "14px",
              color: "var(--color-v2-ink-200)",
              flexShrink: 0,
            }}
          >
            {otherName[0]?.toUpperCase() ?? "?"}
          </div>
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: "15px",
                fontWeight: 500,
                color: "var(--color-v2-ink-100)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {otherName}
            </div>
            <div style={{ fontSize: "11px", color: "var(--color-v2-ink-400)" }}>
              {t('openProfile')}
            </div>
          </div>
        </Link>
        <div style={{ flexShrink: 0 }}>
          <ChatHeaderMenu targetId={otherId} targetFirstName={otherName} />
        </div>
      </header>

      <V2ChatRoom chatId={id} myId={user.id} initial={messages} />
    </main>
  );
}

/**
 * E2: терминальный экран чата, когда собеседник покинул Baxtlilar
 * (deleted/blocked). Без композера — писать некому. История не показывается,
 * но и не теряется (остаётся в БД).
 */
async function GhostChat() {
  const t = await getTranslations('Chat');
  return (
    <main
      style={{
        height: "100dvh",
        display: "flex",
        flexDirection: "column",
        maxWidth: "var(--v2-max-width)",
        margin: "0 auto",
        background: "var(--color-v2-paper)",
        fontFamily: "var(--font-v2-body)",
      }}
    >
      <header
        style={{
          flexShrink: 0,
          padding: "14px 20px",
          borderBottom: "1px solid var(--color-v2-ink-500)",
          display: "flex",
          alignItems: "center",
          gap: "12px",
        }}
      >
        <Link
          href="/v2/chats"
          aria-label={t('placeholder')}
          style={{
            display: "grid",
            placeItems: "center",
            width: "32px",
            height: "32px",
            fontSize: "20px",
            color: "var(--color-v2-ink-200)",
            textDecoration: "none",
          }}
        >
          ←
        </Link>
      </header>
      <div style={{ flex: 1, display: "grid", placeItems: "center", padding: "0 32px", textAlign: "center" }}>
        <div>
          <p style={{ fontSize: "16px", color: "var(--color-v2-ink-200)" }}>
            {t('ghostChatHeading')}
          </p>
          <p style={{ marginTop: "8px", fontSize: "14px", color: "var(--color-v2-ink-400)" }}>
            {t('ghostChatDescription')}
          </p>
        </div>
      </div>
    </main>
  );
}

/**
 * Inline-меню в header — re-uses ProfileSafetyActions через disclosure
 * (открывает в виде flat-list под кнопкой). Для простоты MVP — просто
 * кнопка «...» которая открывает page-overlay actions.
 *
 * Делаем минимальный inline вариант: показываем ProfileSafetyActions целиком
 * как small floating panel при tap.
 */
async function ChatHeaderMenu({
  targetId,
  targetFirstName,
}: {
  targetId: string;
  targetFirstName: string;
}) {
  const t = await getTranslations('Chat');
  return (
    <details style={{ position: "relative" }}>
      <summary
        style={{
          listStyle: "none",
          width: "32px",
          height: "32px",
          display: "grid",
          placeItems: "center",
          fontSize: "20px",
          color: "var(--color-v2-ink-300)",
          cursor: "pointer",
          background: "transparent",
          border: "none",
        }}
        aria-label={t('menu')}
      >
        ⋮
      </summary>
      <div
        style={{
          position: "absolute",
          right: 0,
          top: "calc(100% + 8px)",
          width: "240px",
          padding: "16px",
          background: "var(--color-v2-paper)",
          border: "1px solid var(--color-v2-ink-500)",
          borderRadius: "var(--v2-radius-md)",
          boxShadow: "0 8px 24px rgba(10, 9, 8, 0.12)",
          zIndex: 10,
        }}
      >
        <ProfileSafetyActions targetId={targetId} targetFirstName={targetFirstName} />
      </div>
    </details>
  );
}
