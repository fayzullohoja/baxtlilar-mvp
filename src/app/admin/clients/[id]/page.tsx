import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { requireAdmin, checkInQueueOrSuperPage } from "@/lib/admin/guard";
import { can } from "@/lib/admin/permissions";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { OpsShell } from "@/components/admin-ops/OpsShell";
import { loadClient } from "@/lib/admin/load-client";
import { ClientHero } from "./ClientHero";
import { IdentityTab } from "./IdentityTab";
import { ClientTabs } from "@/components/admin-ops/ClientTabs";
import { PhotosTab } from "./PhotosTab";
import { ProfileTab } from "./ProfileTab";
import { ActivityTab } from "./ActivityTab";
import { ModerationTab } from "./ModerationTab";
import { DangerZone } from "./DangerZone";

export const dynamic = "force-dynamic";

function ipFromHeaders(h: Headers): string | null {
  return (
    h.get("x-envoy-external-address") ??
    h.get("x-real-ip") ??
    h.get("x-forwarded-for")?.split(",").pop()?.trim() ??
    null
  );
}

const VALID_TABS = new Set([
  "identity",
  "profile",
  "photos",
  "activity",
  "moderation",
]);

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  // F-120: карточка раскрывает паспортную PII (ПИНФЛ/паспорт/адрес). Модератор
  // видит её ТОЛЬКО для юзера в своей очереди верификации; super — всегда. Тот же
  // чокпоинт, что у /admin/verifications/[id] — закрывает и PII-утечку через
  // ссылки из фото-очереди, и UUID existence-oracle (200+PII vs 404).
  const session = await requireAdmin();
  const { id } = await params;
  const sp = await searchParams;
  const tab = VALID_TABS.has(sp.tab ?? "") ? (sp.tab as string) : "identity";

  const scope = await checkInQueueOrSuperPage(
    session,
    id,
    "user_view",
    ipFromHeaders(await headers()),
  );
  if ("hide" in scope) notFound();

  const c = await loadClient(id);
  if (!c) notFound();

  const { data: admin } = await supabaseAdmin()
    .from("admin_users")
    .select("login")
    .eq("id", session.adminId)
    .maybeSingle();

  // DZ-1..3: danger-zone только при users.sanction (super). Тянем ban/lifecycle.
  type DangerData = {
    lifecycle_state: string;
    verification_status: string;
    pending_ban_at: string | null;
    pending_ban_by_admin_id: string | null;
    pending_ban_reason: string | null;
  };
  let danger: DangerData | null = null;
  if (can(session.role, "users.sanction")) {
    const { data: u } = await supabaseAdmin()
      .from("users")
      .select(
        "lifecycle_state, verification_status, pending_ban_at, pending_ban_by_admin_id, pending_ban_reason",
      )
      .eq("id", id)
      .maybeSingle();
    danger = (u as DangerData | null) ?? null;
  }

  return (
    <OpsShell adminName={admin?.login ?? "—"} adminRole={session.role}>
      <ClientHero client={c} />
      <ClientTabs clientId={id} active={tab} />
      {tab === "identity" ? <IdentityTab identity={c.identity} /> : null}
      {tab === "profile" ? (
        <ProfileTab userId={id} canEdit={can(session.role, "profiles.edit")} />
      ) : null}
      {tab === "photos" ? <PhotosTab userId={id} /> : null}
      {tab === "activity" ? <ActivityTab userId={id} /> : null}
      {tab === "moderation" ? <ModerationTab userId={id} /> : null}
      {danger ? (
        <DangerZone
          userId={id}
          lifecycleState={danger.lifecycle_state}
          verificationStatus={danger.verification_status}
          pendingBan={
            danger.pending_ban_at
              ? {
                  at: danger.pending_ban_at,
                  byAdminId: danger.pending_ban_by_admin_id ?? "",
                  reason: danger.pending_ban_reason,
                }
              : null
          }
          currentAdminId={session.adminId}
        />
      ) : null}
    </OpsShell>
  );
}
