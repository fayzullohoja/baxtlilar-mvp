import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["ru", "uz", "tr"] as const,
  defaultLocale: "ru",
});

export type Locale = (typeof routing.locales)[number];
