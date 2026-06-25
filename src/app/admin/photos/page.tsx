import { requireAdmin } from "@/lib/admin/guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { unwrapRows } from "@/lib/db/unwrap";
import { signedPhotoUrls } from "@/lib/uploads/storage";
import { V2AdminShell, AdminH1 } from "@/components/v2/AdminShell";
import { PhotoActions } from "@/components/admin/photo-actions";

export const dynamic = "force-dynamic";

/**
 * V2 Admin · Photo Moderation (Blueprint §4.4).
 * Editorial grid: тонкая ink border, owner label uppercase eyebrow.
 */
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
    <V2AdminShell active="/admin/photos" role={session.role}>
      <AdminH1 subtitle={`${list.length} фото в очереди модерации.`}>
        Модерация фото
      </AdminH1>

      {list.length === 0 ? (
        <p
          style={{
            fontSize: "15px",
            color: "var(--color-v2-ink-400)",
            fontFamily: "var(--font-v2-body)",
            padding: "60px 0",
            textAlign: "center",
          }}
        >
          Нет фото на проверке.
        </p>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "20px",
          }}
        >
          {list.map((p) => {
            const owner = owners.get(p.user_id as string) ?? null;
            const url = urls[p.path as string];
            const ownerLabel =
              owner?.telegram_first_name ||
              (owner?.telegram_username ? "@" + owner.telegram_username : "—");
            return (
              <div
                key={p.id as string}
                style={{
                  border: "1px solid var(--color-v2-ink-500)",
                  borderRadius: "var(--v2-radius-md)",
                  overflow: "hidden",
                  background: "var(--color-v2-paper)",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt=""
                  style={{
                    width: "100%",
                    aspectRatio: "3 / 4",
                    objectFit: "cover",
                    display: "block",
                  }}
                />
                <div style={{ padding: "12px 14px" }}>
                  <div
                    style={{
                      fontSize: "10px",
                      textTransform: "uppercase",
                      letterSpacing: "0.12em",
                      color: "var(--color-v2-ink-400)",
                      fontFamily: "var(--font-v2-body)",
                      marginBottom: "8px",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {ownerLabel}
                    {p.is_main ? " · главное" : ""}
                  </div>
                  <PhotoActions photoId={p.id as string} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </V2AdminShell>
  );
}
