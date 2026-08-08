"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ADMIN } from "@/lib/admin/admin-tokens";
import { PhotosTable } from "@/components/admin-ops/photo/PhotosTable";
import { PhotoDrawer } from "@/components/admin-ops/photo/PhotoDrawer";
import { postAdminAction } from "@/lib/admin/use-async-action";
import { ADMIN_ERROR_RU } from "@/lib/admin/labels";
import type { PhotoCase, PhotosFilter } from "@/lib/admin/load-photos";

const TABS: { id: PhotosFilter; label: string }[] = [
  { id: "new", label: "Новые" },
  { id: "overdue", label: "Overdue >24ч" },
];

export function PhotosScreen({
  rows,
  nextCursor,
  filter,
  reasonTemplates,
}: {
  rows: PhotoCase[];
  nextCursor?: string;
  filter: PhotosFilter;
  reasonTemplates: { code: string; text: string }[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<PhotoCase | null>(null);
  const [drawerMode, setDrawerMode] = useState<"view" | "reject">("view");
  // PH-5: id фото с approve «в полёте» → защита от двойного клика (иначе два
  // POST'а на одно фото). Кнопки строки disabled, пока решение не применилось.
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());

  // Ответ ДОЛЖЕН проверяться: раньше fetch игнорировал результат, и провал
  // одобрения (403/500/kill-switch) был неотличим от успеха — фото «пропадало»
  // из очереди по router.refresh(), хотя решение не применилось.
  const [error, setError] = useState<string | null>(null);

  async function quickApprove(p: PhotoCase) {
    if (busyIds.has(p.photo_id)) return;
    setBusyIds((prev) => new Set(prev).add(p.photo_id));
    setError(null);
    try {
      await postAdminAction(
        `/api/admin/photos/${p.photo_id}/decision`,
        { action: "approve" },
        ADMIN_ERROR_RU,
      );
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось одобрить фото.");
    } finally {
      setBusyIds((prev) => {
        const n = new Set(prev);
        n.delete(p.photo_id);
        return n;
      });
    }
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={`/admin/photos?tab=${t.id}`}
            style={{
              padding: "6px 12px",
              border: `1px solid ${ADMIN.border}`,
              borderRadius: 6,
              fontSize: 13,
              color: filter === t.id ? "#fff" : ADMIN.ink700,
              background: filter === t.id ? ADMIN.accent : ADMIN.surface,
              textDecoration: "none",
            }}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {error ? (
        <div style={{ marginBottom: 12, fontSize: 13, color: ADMIN.danger }}>Ошибка: {error}</div>
      ) : null}

      <PhotosTable
        rows={rows}
        busyIds={busyIds}
        onOpen={(p) => {
          setDrawerMode("view");
          setSelected(p);
        }}
        onQuickApprove={(p) => void quickApprove(p)}
        onQuickReject={(p) => {
          setDrawerMode("reject");
          setSelected(p);
        }}
      />

      {nextCursor ? (
        <div style={{ marginTop: 16 }}>
          <Link
            href={`/admin/photos?tab=${filter}&cursor=${encodeURIComponent(nextCursor)}`}
            style={{ color: ADMIN.accent, fontSize: 13 }}
          >
            Следующая страница →
          </Link>
        </div>
      ) : null}

      <PhotoDrawer
        photo={selected}
        reasonTemplates={reasonTemplates}
        onClose={() => setSelected(null)}
        defaultMode={drawerMode}
      />
    </div>
  );
}
