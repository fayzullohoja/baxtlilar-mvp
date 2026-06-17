import { requireAdmin } from "@/lib/admin/guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { unwrapRows } from "@/lib/db/unwrap";
import { signedPhotoUrls } from "@/lib/uploads/storage";
import { AdminShell } from "@/components/admin/shell";
import { PhotoActions } from "@/components/admin/photo-actions";

export const dynamic = "force-dynamic";

export default async function PhotosModeration() {
  const session = await requireAdmin();
  const sb = supabaseAdmin();

  const list = unwrapRows(
    await sb
      .from("profile_photos")
      .select("id, user_id, path, is_main")
      .eq("status", "under_review")
      .order("created_at", { ascending: true })
      .limit(60),
  );

  // Владельцев фото берём отдельным запросом и сшиваем в JS:
  // native-адаптер не делает PostgREST-embed users(...) — раньше этот embed тихо
  // обнулял ВЕСЬ список, и очередь модерации всегда выглядела пустой.
  type Owner = { telegram_first_name?: string; telegram_username?: string };
  const ownerIds = [...new Set(list.map((p) => p.user_id as string))];
  const owners = new Map<string, Owner>();
  if (ownerIds.length) {
    const users = unwrapRows(
      await sb.from("users").select("id, telegram_first_name, telegram_username").in("id", ownerIds),
    );
    for (const u of users) owners.set(u.id as string, u as Owner);
  }

  const urls = await signedPhotoUrls(list.map((p) => p.path as string));

  return (
    <AdminShell active="/admin/photos" role={session.role}>
      <h1 className="text-2xl font-bold text-slate-900 mb-1">Модерация фото</h1>
      <p className="text-sm text-slate-500 mb-6">{list.length} фото на проверке</p>

      {list.length === 0 ? (
        <p className="text-slate-400">Нет фото на проверке.</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {list.map((p) => {
            const owner = owners.get(p.user_id as string) ?? null;
            const url = urls[p.path as string];
            return (
              <div key={p.id as string} className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="w-full aspect-[3/4] object-cover" />
                <div className="p-2 space-y-2">
                  <div className="text-xs text-slate-500 truncate">
                    {owner?.telegram_first_name ||
                      (owner?.telegram_username ? "@" + owner.telegram_username : "—")}
                    {p.is_main ? " · главное" : ""}
                  </div>
                  <PhotoActions photoId={p.id as string} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </AdminShell>
  );
}
