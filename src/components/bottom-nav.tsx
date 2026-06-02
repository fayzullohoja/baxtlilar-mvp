"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

const TABS = [
  { href: "/main", key: "feed", icon: "❤" },
  { href: "/requests", key: "requests", icon: "✉" },
  { href: "/chats", key: "chats", icon: "💬" },
  { href: "/settings", key: "profile", icon: "☰" },
] as const;

export function BottomNav({
  active,
  unread = 0,
}: {
  active: "feed" | "requests" | "chats" | "profile";
  unread?: number;
}) {
  const t = useTranslations("Nav");
  return (
    <nav className="fixed bottom-0 inset-x-0 z-20 mx-auto flex max-w-screen-sm border-t border-baxt-border bg-white pb-[env(safe-area-inset-bottom)]">
      {TABS.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          className={
            "flex-1 flex flex-col items-center justify-center py-2.5 text-[11px] gap-0.5 " +
            (active === tab.key ? "text-baxt-coral" : "text-baxt-muted")
          }
        >
          <span className="relative text-lg leading-none">
            {tab.icon}
            {tab.key === "chats" && unread > 0 ? (
              <span className="absolute -right-2.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-baxt-coral px-1 text-[10px] font-semibold text-white">
                {unread > 9 ? "9+" : unread}
              </span>
            ) : null}
          </span>
          {t(tab.key)}
        </Link>
      ))}
    </nav>
  );
}
