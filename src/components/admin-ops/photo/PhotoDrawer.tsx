"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ADMIN } from "@/lib/admin/admin-tokens";
import { Drawer } from "@/components/admin-ops/Drawer";
import { Button } from "@/components/admin-ops/Button";
import { ReasonPicker } from "@/components/admin-ops/ReasonPicker";
import { StatusPill } from "@/components/admin-ops/StatusPill";
import { photoTypeLabel } from "@/lib/admin/photo-labels";
import type { PhotoCase } from "@/lib/admin/load-photos";

type NegativeAction = "reject" | "needs_replacement";

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
  const [mode, setMode] = useState<"view" | "reason">(
    defaultMode === "reject" ? "reason" : "view",
  );
  const [negative, setNegative] = useState<NegativeAction>("reject");
  const [code, setCode] = useState(reasonTemplates[0]?.code ?? "");
  const [text, setText] = useState(reasonTemplates[0]?.text ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Сброс формы при смене фото/режима — во время рендера (guarded), а не в
  // эффекте (set-state-in-effect). Паттерн «reset state on prop change».
  // ВАЖНО: НЕ гейтить на `photo` — иначе при закрытии (photo=null) prevDrawerKey
  // застревает, и переоткрытие ТОГО ЖЕ фото с тем же режимом даёт равный ключ →
  // сброс пропускается → drawer открывается со stale mode/text/busy. Пустой
  // photo просто рендерит null, лишний сброс безвреден и сходится за 1 рендер.
  const drawerKey = `${photo?.photo_id ?? ""}:${defaultMode ?? "view"}`;
  const [prevDrawerKey, setPrevDrawerKey] = useState(drawerKey);
  if (drawerKey !== prevDrawerKey) {
    setPrevDrawerKey(drawerKey);
    setMode(defaultMode === "reject" ? "reason" : "view");
    setNegative("reject");
    setCode(reasonTemplates[0]?.code ?? "");
    setText(reasonTemplates[0]?.text ?? "");
    setBusy(false);
    setError(null);
  }

  async function submit(action: "approve" | NegativeAction) {
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

  const vs = photo?.client.verification_status;

  return (
    <Drawer open={!!photo} onClose={onClose} width={520}>
      {!photo ? null : (
        <div style={{ padding: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 6 }}>
            <Link
              href={`/admin/clients/${photo.user_id}`}
              style={{ color: ADMIN.accent, textDecoration: "none" }}
            >
              {photo.client.display_name ??
                photo.client.telegram_first_name ??
                "—"}
            </Link>
          </div>
          {/* PH-2 тип фото + PH-8 верификация клиента */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
            <StatusPill kind={photo.photo_type === "family" ? "warning" : "new"}>
              {photoTypeLabel(photo.photo_type)}
            </StatusPill>
            {photo.is_main ? <StatusPill kind="verified">main</StatusPill> : null}
            {vs ? (
              <StatusPill kind={vs === "approved" ? "verified" : "pending"}>
                {vs === "approved" ? "верифицирован" : `вериф: ${vs}`}
              </StatusPill>
            ) : null}
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
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Button variant="primary" onClick={() => submit("approve")} disabled={busy}>
                ✓ Одобрить
              </Button>
              <Button
                onClick={() => {
                  setNegative("needs_replacement");
                  setMode("reason");
                }}
                disabled={busy}
              >
                ↻ Заменить…
              </Button>
              <Button variant="danger" onClick={() => {
                setNegative("reject");
                setMode("reason");
              }} disabled={busy}>
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
              <div style={{ fontSize: 12, color: ADMIN.ink700, marginBottom: 10 }}>
                {negative === "needs_replacement"
                  ? "Причина запроса замены:"
                  : "Причина отклонения:"}
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
                  onClick={() => submit(negative)}
                  disabled={busy || text.length < 3}
                >
                  {busy
                    ? "Отправляем…"
                    : negative === "needs_replacement"
                      ? "Запросить замену"
                      : "Подтвердить reject"}
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
