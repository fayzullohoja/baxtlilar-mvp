"use client";

import { useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/v2/Button";

type Props = {
  cta: string;
  ctaPending?: string;
  /** Если задан — рядом с primary показывается ghost "Пропустить тур" → ready. */
  showSkip?: boolean;
};

/**
 * Continue-кнопка для tutorial-экранов. POST на /api/onboarding/tutorial с
 * текущим шагом — сервер сам знает следующий по ALLOWED_TRANSITIONS и
 * редиректит на нужный путь.
 *
 * Skip всегда ведёт в "ready" (одной кнопкой минуем оставшиеся шаги).
 */
export function TutorialStep({
  cta,
  ctaPending = "Подождите…",
  showSkip = true,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function advance(skip: boolean) {
    if (pending) return;
    startTransition(async () => {
      const res = await fetch("/api/onboarding/tutorial", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ skip }),
      });
      if (!res.ok) return;
      const data = (await res.json()) as { ok: boolean; next?: string };
      if (data.ok && data.next) router.replace(data.next);
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <Button onClick={() => advance(false)} disabled={pending} variant="primary">
        {pending ? ctaPending : cta}
      </Button>
      {showSkip ? (
        <Button onClick={() => advance(true)} disabled={pending} variant="ghost">
          Пропустить тур
        </Button>
      ) : null}
    </div>
  );
}
