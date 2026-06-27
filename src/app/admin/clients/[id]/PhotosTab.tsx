import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { signedPhotoUrls } from "@/lib/uploads/storage";
import { ADMIN } from "@/lib/admin/admin-tokens";
import { StatusPill } from "@/components/admin-ops/StatusPill";

export async function PhotosTab({ userId }: { userId: string }) {
  const { data: photos } = await supabaseAdmin()
    .from("profile_photos")
    .select("id, path, status, is_main, ord, created_at")
    .eq("user_id", userId)
    .order("ord", { ascending: true });

  const rows = (photos ?? []) as Array<{
    id: string;
    path: string;
    status: string;
    is_main: boolean;
    ord: number;
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
                src={url}
                alt=""
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
                fontSize: 11,
                color: ADMIN.ink500,
              }}
            >
              #{p.ord + 1}
              {p.is_main ? <StatusPill kind="verified">main</StatusPill> : null}
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
                {p.status}
              </StatusPill>
            </div>
          </div>
        );
      })}
    </div>
  );
}
