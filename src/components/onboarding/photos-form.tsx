"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { postForm, postJson } from "@/lib/client/api";
import { PrimaryButton } from "@/components/ui/screen";

type Photo = { id: string; url: string; is_main: boolean };

export function PhotosForm() {
  const t = useTranslations("Anketa");
  const tc = useTranslations("Common");
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function add(file: File) {
    setBusy(true);
    setErr(null);
    const fd = new FormData();
    fd.append("file", file);
    const r = await postForm("/api/onboarding/profile/photo", fd);
    if (r.ok && r.photo) setPhotos((p) => [...p, r.photo as Photo]);
    else setErr(r.error === "max_photos" ? t("photos_max") : t("upload_err"));
    setBusy(false);
  }

  async function remove(id: string) {
    await fetch(`/api/onboarding/profile/photo/${id}`, { method: "DELETE" });
    setPhotos((p) => p.filter((x) => x.id !== id));
  }

  async function done() {
    setBusy(true);
    const r = await postJson("/api/onboarding/profile/photos-done");
    if (r.ok && r.next) router.push(r.next);
    else {
      setErr(t("photos_need_one"));
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        {photos.map((p, i) => (
          <div key={p.id} className="relative aspect-[3/4] rounded-xl overflow-hidden border border-baxt-border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.url} alt="" className="w-full h-full object-cover" />
            {i === 0 ? (
              <span className="absolute top-1 left-1 text-[10px] bg-baxt-coral text-white px-1.5 py-0.5 rounded-full">
                {t("main_badge")}
              </span>
            ) : null}
            <button
              onClick={() => remove(p.id)}
              className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/50 text-white text-xs"
            >
              ✕
            </button>
          </div>
        ))}
        {photos.length < 3 ? (
          <button
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="aspect-[3/4] rounded-xl border-2 border-dashed border-baxt-border bg-baxt-pink-bg text-baxt-muted text-sm hover:border-baxt-coral"
          >
            + {t("add_photo")}
          </button>
        ) : null}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void add(f);
          e.target.value = "";
        }}
      />
      <p className="text-xs text-baxt-muted">{t("photos_hint")}</p>
      {err ? <p className="text-sm text-baxt-coral-dk">{err}</p> : null}
      <PrimaryButton onClick={done} disabled={busy || photos.length === 0}>
        {tc("continue")}
      </PrimaryButton>
    </div>
  );
}
