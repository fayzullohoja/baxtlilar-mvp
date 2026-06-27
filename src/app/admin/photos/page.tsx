import { requireAdmin } from "@/lib/admin/guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { OpsShell } from "@/components/admin-ops/OpsShell";
import {
  loadPhotosQueue,
  type PhotosFilter,
} from "@/lib/admin/load-photos";
import { loadReasonTemplates } from "@/lib/admin/load-reason-templates";
import { PhotosScreen } from "./PhotosScreen";

export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; cursor?: string }>;
}) {
  const session = await requireAdmin();
  const sp = await searchParams;
  const filter: PhotosFilter = sp.tab === "overdue" ? "overdue" : "new";

  const { data: admin } = await supabaseAdmin()
    .from("admin_users")
    .select("login")
    .eq("id", session.adminId)
    .maybeSingle();

  const [{ rows, next_cursor }, reasonTemplates] = await Promise.all([
    loadPhotosQueue(filter, 60, sp.cursor),
    loadReasonTemplates("photo", "ru"),
  ]);

  return (
    <OpsShell adminName={admin?.login ?? "—"} adminRole={session.role}>
      <h1 style={{ fontSize: 22, fontWeight: 500, marginBottom: 16 }}>
        Фото-модерация
      </h1>
      <PhotosScreen
        rows={rows}
        nextCursor={next_cursor}
        filter={filter}
        reasonTemplates={reasonTemplates}
      />
    </OpsShell>
  );
}
