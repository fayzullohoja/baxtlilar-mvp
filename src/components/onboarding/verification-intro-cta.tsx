"use client";

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";

// Risk #8: double-tap → пусть 409 трактуется как success (юзер уже advanced
// в другой вкладке/гонке). Кнопка disabled пока pending — visual guard.
export function VerificationIntroCta({
  label,
  pendingLabel,
  errorLabel,
}: {
  label: string;
  pendingLabel: string;
  errorLabel: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onContinue = () => {
    if (pending) return;
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/onboarding/verification-intro/continue", {
        method: "POST",
        headers: { "content-type": "application/json" },
      });
      // 200 ok ИЛИ 409 already_advanced → оба ведут вперёд
      if (res.ok || res.status === 409) {
        router.replace("/onboarding/document");
        return;
      }
      setError(errorLabel);
    });
  };

  return (
    <div className="mt-6 flex flex-col gap-2">
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <button
        onClick={onContinue}
        disabled={pending}
        className="bg-baxt-coral text-white font-semibold py-3 px-4 rounded-2xl shadow-sm hover:opacity-90 disabled:opacity-60 transition"
      >
        {pending ? pendingLabel : label}
      </button>
    </div>
  );
}
