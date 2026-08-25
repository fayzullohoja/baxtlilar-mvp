import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { signedPhotoUrls } from "@/lib/uploads/storage";
import { thumb } from "@/lib/storage/thumb-url";
import { ADMIN } from "@/lib/admin/admin-tokens";
import { StatusPill } from "@/components/admin-ops/StatusPill";
import { photoTypeLabel, photoStatusLabel } from "@/lib/admin/photo-labels";
import { loadReasonTemplates } from "@/lib/admin/load-reason-templates";
import { PhotoCardActions } from "./PhotoCardActions";

const ACTIONABLE = new Set(["under_review", "uploaded"]);

export async function PhotosTab({ userId }: { userId: string }) {
  const [{ data: photos }, reasonTemplates] = await Promise.all([
    supabaseAdmin()
      .from("profile_photos")
      .select("id, path, status, is_main, ord, photo_type, created_at")
      .eq("user_id", userId)
      .order("ord", { ascending: true }),
    loadReasonTemplates("photo", "ru"),
  ]);

  const rows = (photos ?? []) as Array<{
    id: string;
    path: string;
    status: string;
    is_main: boolean;
    ord: number;
    photo_type: string;
  }>;

  if (rows.length === 0) {
    return (
      <div
        style={{
          padding: 24,
          border: `1px solid ${ADMIN.border}`,
          borderRadius: 8,
          background: ADMIN.surface,
          color: ADMIN.ink500,
          fontSize: 13,
        }}
      >
        Нет загруженных фото.
      </div>
    );
  }

  const urls = await signedPhotoUrls(rows.map((p) => p.path));

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
        gap: 16,
      }}
    >
      {rows.map((p) => {
        const url = urls[p.path];
        return (
          <div
            key={p.id}
            style={{
              border: `1px solid ${ADMIN.border}`,
              borderRadius: 8,
              background: ADMIN.surface,
              overflow: "hidden",
            }}
          >
            {url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={thumb(url, 640) ?? url}
                alt=""
                // Здесь lazy безопасна, в отличие от списков: signedPhotoUrls
                // берёт TTL по умолчанию (час), и к моменту прокрутки подпись
                // ещё жива. В очереди фото и в списке клиентов TTL 300 секунд,
                // поэтому там отложенный запрос вернул бы 403.
                loading="lazy"
                decoding="async"
                style={{ width: "100%", aspectRatio: "3/4", objectFit: "cover" }}
              />
            ) : (
              <div
                style={{
                  width: "100%",
                  aspectRatio: "3/4",
                  background: ADMIN.surface2,
                }}
              />
            )}
            <div
              style={{
                padding: 8,
                display: "flex",
                gap: 4,
                alignItems: "center",
                flexWrap: "wrap",
                fontSize: 11,
                color: ADMIN.ink500,
              }}
            >
              #{p.ord + 1}
              {p.is_main ? <StatusPill kind="verified">main</StatusPill> : null}
              <StatusPill kind={p.photo_type === "family" ? "warning" : "new"}>
                {photoTypeLabel(p.photo_type)}
              </StatusPill>
              <span style={{ flex: 1 }} />
              <StatusPill
                kind={
                  p.status === "approved"
                    ? "verified"
                    : p.status === "rejected"
                      ? "rejected"
                      : "pending"
                }
              >
                {photoStatusLabel(p.status)}
              </StatusPill>
            </div>
            {/* PH-3: действия только для фото в активной модерации */}
            {ACTIONABLE.has(p.status) ? (
              <div style={{ borderTop: `1px solid ${ADMIN.border}` }}>
                <PhotoCardActions photoId={p.id} reasonTemplates={reasonTemplates} />
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
