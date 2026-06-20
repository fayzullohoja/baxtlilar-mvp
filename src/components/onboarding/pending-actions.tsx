"use client";

import { useRouter } from "@/i18n/navigation";
import "@/lib/telegram/web-app-types";

// Две кнопки на pending-экране (Экран 9/10 спеки):
//  - «Понятно, закрыть»: tg.close() — мини-аппа сворачивается; юзер вернётся
//    по push'у о результате модерации.
//  - «На главную»: client-side навигация на /, чтобы юзер мог свернуть в
//    background и продолжить пользоваться TG.
export function PendingActions({
  closeLabel,
  homeLabel,
}: {
  closeLabel: string;
  homeLabel: string;
}) {
  const router = useRouter();
  const close = () => {
    const tg = window.Telegram?.WebApp;
    if (tg?.close) tg.close();
    else router.push("/");
  };
  return (
    <div className="mt-6 flex flex-col gap-2">
      <button
        onClick={close}
        className="bg-baxt-coral text-white font-semibold py-3 px-4 rounded-2xl shadow-sm hover:opacity-90 transition"
      >
        {closeLabel}
      </button>
      <button
        onClick={() => router.push("/")}
        className="text-baxt-coral font-medium py-2 px-4 rounded-2xl hover:bg-baxt-coral-bg transition"
      >
        {homeLabel}
      </button>
    </div>
  );
}
