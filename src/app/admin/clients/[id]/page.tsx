import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { requireAdmin, checkInQueueOrSuperPage } from "@/lib/admin/guard";
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

  return (
    <OpsShell adminName={admin?.login ?? "—"} adminRole={session.role}>
      <ClientHero client={c} />
      <ClientTabs clientId={id} active={tab} />
      {tab === "identity" ? <IdentityTab identity={c.identity} /> : null}
      {tab === "profile" ? <ProfileTab userId={id} /> : null}
      {tab === "photos" ? <PhotosTab userId={id} /> : null}
      {tab === "activity" ? <ActivityTab userId={id} /> : null}
      {tab === "moderation" ? <ModerationTab userId={id} /> : null}
    </OpsShell>
  );
}
