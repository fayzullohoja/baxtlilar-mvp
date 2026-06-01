"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { postForm } from "@/lib/client/api";
import { PrimaryButton } from "@/components/ui/screen";

const ERR_KEY: Record<string, string> = {
  bad_type: "upload_err_bad_type",
  too_large: "upload_err_too_large",
};

/** Переиспользуемая форма загрузки фото (паспорт / селфи). */
export function UploadForm({
  endpoint,
  uploadLabel,
  capture,
}: {
  endpoint: string;
  uploadLabel: string;
  capture?: "user" | "environment";
}) {
  const t = useTranslations("Onboarding");
  const tc = useTranslations("Common");
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!file) return;
    setBusy(true);
    setError(null);
    const fd = new FormData();
    fd.append("file", file);
    const r = await postForm(endpoint, fd);
    if (r.ok && r.next) router.push(r.next);
    else {
      setError(t(ERR_KEY[r.error ?? ""] ?? "upload_err_bad_type"));
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <button
        onClick={() => inputRef.current?.click()}
        className="w-full rounded-2xl border-2 border-dashed border-baxt-border bg-baxt-pink-bg px-4 py-8 text-center text-sm text-baxt-muted hover:border-baxt-coral"
      >
        {fileName ?? uploadLabel}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic"
        capture={capture}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null;
          setFile(f);
          setFileName(f?.name ?? null);
        }}
      />
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <PrimaryButton onClick={submit} disabled={busy || !file}>
        {tc("continue")}
      </PrimaryButton>
    </div>
  );
}
