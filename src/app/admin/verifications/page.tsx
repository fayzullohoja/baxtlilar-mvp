import { redirect } from "next/navigation";

// Старый список верификации заменён новой студией (/admin/queue/mine → /admin/cases/[id]).
// Редирект сохраняет старые ссылки/закладки рабочими.
export default function Page() {
  redirect("/admin/queue/mine");
}
