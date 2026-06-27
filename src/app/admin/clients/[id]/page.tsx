import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { OpsShell } from "@/components/admin-ops/OpsShell";
import { loadClient } from "@/lib/admin/load-client";
import { ClientHero } from "./ClientHero";
import { IdentityTab } from "./IdentityTab";
import { ClientTabs } from "@/components/admin-ops/ClientTabs";
import { PhotosTab } from "./PhotosTab";
import { ActivityTab } from "./ActivityTab";
import { ModerationTab } from "./ModerationTab";
import { ADMIN } from "@/lib/admin/admin-tokens";

export const dynamic = "force-dynamic";

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
  // NOTE (F-120): карточка доступна любому админу. Browse-anyone закрыт на
  // уровне директории (/admin/clients = super-only) — модератор попадает сюда
  // только из своей очереди/фото. Полноценный moderator-scope карточки ждёт
  // редизайна модели scope под Shadow Active (где queued-юзер уже lifecycle=active).
  const session = await requireAdmin();
  const { id } = await params;
  const sp = await searchParams;
  const tab = VALID_TABS.has(sp.tab ?? "") ? (sp.tab as string) : "identity";

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
      {tab === "photos" ? <PhotosTab userId={id} /> : null}
      {tab === "activity" ? <ActivityTab userId={id} /> : null}
      {tab === "moderation" ? <ModerationTab userId={id} /> : null}
      {tab === "profile" ? (
        <div style={{ padding: 24, color: ADMIN.ink500, fontSize: 13 }}>
          Profile tab (анкета знакомств) — Sprint 3.
        </div>
      ) : null}
    </OpsShell>
  );
}
