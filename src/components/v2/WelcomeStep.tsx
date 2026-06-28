"use client";

import { useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/v2/Button";

type Props = {
  cta?: string;
  ctaPending?: string;
};

/**
 * V2 ext 2026-06-28 — Continue-кнопка для welcome серии (mission/safety/rules).
 * POST на /api/onboarding/welcome — сервер двигает onboarding_step по карте
 * (см. NEXT_STEP в route.ts) и возвращает next path.
 *
 * Паттерн скопирован с TutorialStep, но без skip (welcome серию проходим
 * полностью — это про trust, а не про техническую обучалку).
 */
export function WelcomeStep({
  cta = "Дальше",
  ctaPending = "Подождите…",
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function advance() {
    if (pending) return;
    startTransition(async () => {
      const res = await fetch("/api/onboarding/welcome", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) return;
      const data = (await res.json()) as { ok: boolean; next?: string };
      if (data.ok && data.next) router.replace(data.next);
    });
  }

  return (
    <Button
      onClick={advance}
      disabled={pending}
      variant="primary"
    >
      {pending ? ctaPending : cta}
    </Button>
  );
}
