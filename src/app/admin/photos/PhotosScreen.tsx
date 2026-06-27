"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ADMIN } from "@/lib/admin/admin-tokens";
import { PhotosTable } from "@/components/admin-ops/photo/PhotosTable";
import { PhotoDrawer } from "@/components/admin-ops/photo/PhotoDrawer";
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

  async function quickApprove(p: PhotoCase) {
    await fetch(`/api/admin/photos/${p.photo_id}/decision`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "approve" }),
    });
    router.refresh();
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

      <PhotosTable
        rows={rows}
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
