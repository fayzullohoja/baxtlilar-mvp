"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { useTransition } from "react";

export function LanguageSwitcher() {
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale();
  const t = useTranslations("Lang");
  const [pending, start] = useTransition();

  return (
    <div className="flex gap-1 text-xs font-medium">
      {routing.locales.map((l) => (
        <button
          key={l}
          disabled={pending}
          onClick={() => start(() => router.replace(pathname, { locale: l }))}
          className={
            l === locale
              ? "px-3 py-1 rounded-full bg-baxt-coral text-white"
              : "px-3 py-1 rounded-full bg-baxt-card text-baxt-navy border border-baxt-border hover:border-baxt-coral"
          }
        >
          {t(l)}
        </button>
      ))}
    </div>
  );
}
