/**
 * V2 Settings (Blueprint §3.4 C8).
 *
 * Один экран: краткий self-summary вверху (имя, возраст, город, статус),
 * actions: pause/resume + delete account. Edit-flow для анкеты —
 * пока редиректит в re-flow онбординга (TODO Sprint 16).
 */

import { setRequestLocale, getTranslations } from "next-intl/server";
import { requireActiveUser } from "@/lib/auth/active-guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ageFromDate } from "@/lib/profile/schemas";
import { cityLabel } from "@/lib/profile/cities";
import { getUnreadTotal } from "@/lib/chat/list";
import { BottomNav } from "@/components/bottom-nav";
import { MiniAppShell } from "@/components/v2/MiniAppShell";
import { Headline } from "@/components/v2/Headline";
import { V2SettingsActions } from "@/components/v2/SettingsActions";
import { deriveRole, ROLE_LABEL } from "@/lib/v2/permissions";

export const dynamic = "force-dynamic";

function firstWord(s: string): string {
  return s.trim().split(/\s+/)[0] ?? s;
}

export default async function V2SettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('Settings');
  const user = await requireActiveUser(locale, { allowPaused: true });
  const sb = supabaseAdmin();

  const { data: p } = await sb
    .from("user_profiles")
    .select("display_name, birth_date, city")
    .eq("user_id", user.id)
    .maybeSingle();

  const age = p?.birth_date ? ageFromDate(p.birth_date as string) : null;
  const role = deriveRole(user.lifecycle_state, user.verification_status);
  const roleLabel = ROLE_LABEL[role][locale === "uz" ? "uz" : "ru"];
  const unread = await getUnreadTotal(user.id);
  const name = firstWord((p?.display_name as string) ?? "");

  return (
    <>
      <MiniAppShell eyebrow={t('title')} align="top" footer={null}>
        <div style={{ marginBottom: "32px" }}>
          <Headline size="lg" as="h1">
            {name || t('profileFallback')}
            {age ? `, ${age}` : ""}
          </Headline>
          <div
            style={{
              marginTop: "8px",
              fontSize: "14px",
              color: "var(--color-v2-ink-400)",
              fontFamily: "var(--font-v2-body)",
            }}
          >
            {p?.city ? cityLabel(p.city as string, locale) : null}
          </div>
          <div
            style={{
              marginTop: "12px",
              fontSize: "11px",
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              color: "var(--color-v2-ink-400)",
              fontFamily: "var(--font-v2-body)",
            }}
          >
            {t('statusLabel')} · {roleLabel}
          </div>
        </div>

        <V2SettingsActions paused={user.lifecycle_state === "paused"} />

        <div
          style={{
            marginTop: "60px",
            paddingTop: "24px",
            borderTop: "1px solid var(--color-v2-ink-500)",
            fontSize: "12px",
            color: "var(--color-v2-ink-400)",
            fontFamily: "var(--font-v2-body)",
            lineHeight: "1.55",
          }}
        >
          {t('versionInfo')}
        </div>
        <div style={{ height: "80px" }} />
      </MiniAppShell>
      <BottomNav active="profile" unread={unread} />
    </>
  );
}
