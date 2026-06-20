"use client";

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";

const SOURCES = [
  "telegram",
  "instagram",
  "friends",
  "facebook",
  "tiktok",
  "youtube",
  "ads",
  "search",
  "media",
  "event",
  "other",
] as const;
type Source = (typeof SOURCES)[number];

export function AttributionForm({
  options,
  cta,
  skip,
  ctaPending,
  errorLabel,
}: {
  options: Record<Source, string>;
  cta: string;
  skip: string;
  ctaPending: string;
  errorLabel: string;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Source | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit(payload: { source?: Source; skip?: boolean }) {
    if (pending) return;
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/onboarding/attribution", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        setError(errorLabel);
        return;
      }
      router.replace("/main");
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2 mb-4">
        {SOURCES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSelected(s)}
            className={`rounded-2xl border px-3 py-3 text-sm text-baxt-navy text-left transition ${
              selected === s
                ? "border-baxt-coral bg-baxt-coral-bg font-semibold"
                : "border-baxt-border bg-baxt-card hover:border-baxt-coral/60"
            }`}
          >
            {options[s]}
          </button>
        ))}
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <button
        type="button"
        disabled={!selected || pending}
        onClick={() => selected && submit({ source: selected })}
        className="bg-baxt-coral text-white font-semibold py-3 px-4 rounded-2xl shadow-sm disabled:opacity-50 hover:opacity-90 transition"
      >
        {pending ? ctaPending : cta}
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => submit({ skip: true })}
        className="text-baxt-coral font-medium py-2 px-4 rounded-2xl hover:bg-baxt-coral-bg disabled:opacity-50 transition"
      >
        {skip}
      </button>
    </div>
  );
}
