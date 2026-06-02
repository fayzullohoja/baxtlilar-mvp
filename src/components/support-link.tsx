import { env } from "@/lib/env";

/** Кнопка-ссылка на канал поддержки (если SUPPORT_URL задан). Для тупиковых экранов. */
export function SupportLink({ label }: { label: string }) {
  const url = env().SUPPORT_URL;
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-4 inline-block rounded-full border border-baxt-border px-5 py-2 text-sm font-medium text-baxt-coral"
    >
      {label}
    </a>
  );
}
