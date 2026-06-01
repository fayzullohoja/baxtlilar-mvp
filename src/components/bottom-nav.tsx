"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

const TABS = [
  { href: "/main", key: "feed", icon: "❤" },
  { href: "/requests", key: "requests", icon: "✉" },
  { href: "/chats", key: "chats", icon: "💬" },
  { href: "/settings", key: "profile", icon: "☰" },
] as const;

export function BottomNav({ active }: { active: "feed" | "requests" | "chats" | "profile" }) {
  const t = useTranslations("Nav");
  return (
    <nav className="fixed bottom-0 inset-x-0 bg-white border-t border-baxt-border flex z-20">
      {TABS.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          className={
            "flex-1 flex flex-col items-center justify-center py-2.5 text-[11px] gap-0.5 " +
            (active === tab.key ? "text-baxt-coral" : "text-baxt-muted")
          }
        >
          <span className="text-lg leading-none">{tab.icon}</span>
          {t(tab.key)}
        </Link>
      ))}
    </nav>
  );
}
