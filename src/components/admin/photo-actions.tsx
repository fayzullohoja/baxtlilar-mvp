"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function PhotoActions({ photoId }: { photoId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function decide(action: "approve" | "reject") {
    if (action === "reject" && !window.confirm("Отклонить фото?")) return;
    setBusy(true);
    await fetch(`/api/admin/photos/${photoId}/decision`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="flex gap-2">
      <button
        onClick={() => decide("approve")}
        disabled={busy}
        className="flex-1 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm py-1.5 disabled:opacity-50"
      >
        ✓ Одобрить
      </button>
      <button
        onClick={() => decide("reject")}
        disabled={busy}
        className="flex-1 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm py-1.5 disabled:opacity-50"
      >
        ✕ Отклонить
      </button>
    </div>
  );
}
