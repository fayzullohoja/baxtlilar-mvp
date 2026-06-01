"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { postForm } from "@/lib/client/api";
import { PrimaryButton } from "@/components/ui/screen";

function FilePick({
  label,
  capture,
  onPick,
}: {
  label: string;
  capture: "user" | "environment";
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
      setError(r.error === "too_large" ? t("upload_err_too_large") : t("upload_err_bad_type"));
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      {showPassport ? (
        <FilePick label={t("doc_upload")} capture="environment" onPick={setPassport} />
      ) : null}
      {showSelfie ? <FilePick label={t("selfie_upload")} capture="user" onPick={setSelfie} /> : null}
      {error ? <p className="text-sm text-baxt-coral-dk">{error}</p> : null}
      <PrimaryButton onClick={submit} disabled={busy || (!passport && !selfie)}>
        {t("submit_to_review")}
      </PrimaryButton>
    </div>
  );
}
