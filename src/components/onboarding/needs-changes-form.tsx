"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { uploadErrorKey } from "@/lib/uploads/error-copy";
import { useRouter } from "@/i18n/navigation";
import { postForm } from "@/lib/client/api";
import { PrimaryButton } from "@/components/ui/screen";

function FilePick({
  label,
  capture,
  onPick,
}: {
  label: string;
  // Не задан → нативный пикер (галерея/файлы/камера). "user" → фронт-камера (селфи).
  capture?: "user" | "environment";
  onPick: (f: File | null) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [name, setName] = useState<string | null>(null);
  return (
    <div>
      <button
        type="button"
        onClick={() => ref.current?.click()}
        className="w-full rounded-2xl border-2 border-dashed border-baxt-border bg-baxt-pink-bg px-4 py-5 text-sm text-baxt-muted hover:border-baxt-coral"
      >
        {name ?? label}
      </button>
      <input
        ref={ref}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic"
        capture={capture}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null;
          setName(f?.name ?? null);
          onPick(f);
        }}
      />
    </div>
  );
}

export function NeedsChangesForm({ target = "both" }: { target?: "passport" | "selfie" | "both" }) {
  const t = useTranslations("Onboarding");
  const tUpload = useTranslations("Upload");
  const router = useRouter();
  const [passport, setPassport] = useState<File | null>(null);
  const [selfie, setSelfie] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const showPassport = target === "passport" || target === "both";
  const showSelfie = target === "selfie" || target === "both";

  async function submit() {
    if (!passport && !selfie) return;
    setBusy(true);
    setError(null);
    const fd = new FormData();
    if (passport) fd.append("passport", passport);
    if (selfie) fd.append("selfie", selfie);
    const r = await postForm("/api/onboarding/fix", fd);
    if (r.ok && r.next) router.push(r.next);
    else {
      // Раньше здесь различался ровно один код: всё, что не too_large,
      // подписывалось как «неподходящий тип файла». Человек с правильным JPEG,
      // которому модератор вынес блокирующий отказ или чей документ попал в
      // чёрный список, получал совет пересохранить снимок в другом формате и
      // ходил по кругу. Теперь подпись берётся из общего словаря кодов.
      setError(tUpload(`errors.${uploadErrorKey(r.error)}`));
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      {showPassport ? (
        // Документ — без capture: выбор из галереи/файлов или камера (по запросу оунера).
        <FilePick label={t("doc_upload")} onPick={setPassport} />
      ) : null}
      {showSelfie ? <FilePick label={t("selfie_upload")} capture="user" onPick={setSelfie} /> : null}
      {error ? <p className="text-sm text-baxt-coral-dk">{error}</p> : null}
      <PrimaryButton onClick={submit} disabled={busy || (!passport && !selfie)}>
        {t("submit_to_review")}
      </PrimaryButton>
    </div>
  );
}
