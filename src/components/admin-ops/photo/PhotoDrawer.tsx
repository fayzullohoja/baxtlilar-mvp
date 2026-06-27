"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ADMIN } from "@/lib/admin/admin-tokens";
import { Drawer } from "@/components/admin-ops/Drawer";
import { Button } from "@/components/admin-ops/Button";
import { ReasonPicker } from "./ReasonPicker";
import type { PhotoCase } from "@/lib/admin/load-photos";

export function PhotoDrawer({
  photo,
  reasonTemplates,
  onClose,
  defaultMode,
}: {
  photo: PhotoCase | null;
  reasonTemplates: { code: string; text: string }[];
  onClose: () => void;
  defaultMode?: "view" | "reject";
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"view" | "reject">(defaultMode ?? "view");
  const [code, setCode] = useState(reasonTemplates[0]?.code ?? "");
  const [text, setText] = useState(reasonTemplates[0]?.text ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (photo) {
      setMode(defaultMode ?? "view");
      setCode(reasonTemplates[0]?.code ?? "");
      setText(reasonTemplates[0]?.text ?? "");
      setError(null);
    }
  }, [photo, defaultMode, reasonTemplates]);

  async function submit(action: "approve" | "reject") {
    if (!photo) return;
    setBusy(true);
    setError(null);
    try {
      const body =
        action === "approve"
          ? { action }
          : { action, reason_code: code, reason_text: text };
      const r = await fetch(`/api/admin/photos/${photo.photo_id}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!d.ok) {
        setError(d.error ?? "unknown");
        setBusy(false);
        return;
      }
      onClose();
      router.refresh();
    } catch {
      setError("network");
      setBusy(false);
    }
  }

  return (
    <Drawer open={!!photo} onClose={onClose} width={520}>
      {!photo ? null : (
        <div style={{ padding: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>
            <Link
              href={`/admin/clients/${photo.user_id}`}
              style={{ color: ADMIN.accent, textDecoration: "none" }}
            >
              {photo.client.display_name ??
                photo.client.telegram_first_name ??
                "—"}
            </Link>
          </div>
          <div style={{ fontSize: 12, color: ADMIN.ink500, marginBottom: 16 }}>
            Фото #{photo.ord + 1} · загружено{" "}
            {new Date(photo.created_at).toLocaleString("ru-RU")}
          </div>

          {photo.signed_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photo.signed_url}
              alt=""
              style={{
                width: "100%",
                borderRadius: 6,
                marginBottom: 16,
                maxHeight: 480,
                objectFit: "contain",
                background: "#0d0d0d",
              }}
            />
          ) : null}

          {mode === "view" ? (
            <div style={{ display: "flex", gap: 8 }}>
              <Button
                variant="primary"
                onClick={() => submit("approve")}
                disabled={busy}
              >
                ✓ Одобрить
              </Button>
              <Button
                variant="danger"
                onClick={() => setMode("reject")}
                disabled={busy}
              >
                ✕ Отклонить…
              </Button>
            </div>
          ) : (
            <div
              style={{
                padding: 16,
                background: ADMIN.bg,
                borderRadius: 6,
                border: `1px solid ${ADMIN.border}`,
              }}
            >
              <div
                style={{ fontSize: 12, color: ADMIN.ink700, marginBottom: 10 }}
              >
                Причина отклонения:
              </div>
              <ReasonPicker
                templates={reasonTemplates}
                selectedCode={code}
                customText={text}
                onSelectCode={setCode}
                onCustomTextChange={setText}
              />
              <div
                style={{
                  marginTop: 16,
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 8,
                }}
              >
                <Button onClick={() => setMode("view")} disabled={busy}>
                  Отмена
                </Button>
                <Button
                  variant="danger"
                  onClick={() => submit("reject")}
                  disabled={busy || text.length < 3}
                >
                  {busy ? "Отправляем…" : "Подтвердить reject"}
                </Button>
              </div>
            </div>
          )}

          {error ? (
            <div style={{ color: ADMIN.danger, marginTop: 12, fontSize: 13 }}>
              Ошибка: {error}
            </div>
          ) : null}

          <Link
            href={`/admin/clients/${photo.user_id}`}
            style={{
              display: "block",
              marginTop: 24,
              color: ADMIN.accent,
              fontSize: 13,
              textDecoration: "none",
            }}
          >
            → Открыть профиль клиента
          </Link>
        </div>
      )}
    </Drawer>
  );
}
