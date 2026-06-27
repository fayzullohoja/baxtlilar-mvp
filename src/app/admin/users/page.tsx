import { redirect } from "next/navigation";

// «Пользователи» слиты с «Клиентами» (директория = поиск + фильтры status/gender).
// Старая ban-кнопка (UserActions) была сломана (слала {reason} без F-119 action) —
// полноценный F-119-бан в карточке клиента = Sprint 3.
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; gender?: string }>;
}) {
  const sp = await searchParams;
  const qs = new URLSearchParams();
  if (sp.status) qs.set("status", sp.status);
  if (sp.gender) qs.set("gender", sp.gender);
  const q = qs.toString();
  redirect(`/admin/clients${q ? `?${q}` : ""}`);
}
