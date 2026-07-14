import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/guard";
import { can } from "@/lib/admin/permissions";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { OpsShell } from "@/components/admin-ops/OpsShell";
import { ADMIN } from "@/lib/admin/admin-tokens";
import { LOCALES, flatBase, fetchOverrides, type Locale } from "@/lib/i18n/overrides";
import { ContentEditor, type EditorData } from "./ContentEditor";

export const dynamic = "force-dynamic";

/**
 * Конструктор текстовок (Tier 1). Правка строк локализации мини-аппа без деплоя.
 * capability i18n.edit (super + moderator). Оверрайды хранятся в i18n_overrides и
 * накладываются на статичную базу в getRequestConfig.
 */
export default async function ContentPage() {
  const session = await requireAdmin();
  if (!can(session.role, "i18n.edit")) notFound();

  const { data: me } = await supabaseAdmin()
    .from("admin_users")
    .select("login")
    .eq("id", session.adminId)
    .maybeSingle();

  const bundles = await Promise.all(
    LOCALES.map(async (loc) => {
      const [base, override] = await Promise.all([flatBase(loc), fetchOverrides(loc)]);
      return [loc, { base, override }] as const;
    }),
  );
  const data = Object.fromEntries(bundles) as EditorData;

  return (
    <OpsShell adminName={me?.login ?? "—"} adminRole={session.role}>
      <h1 style={{ fontSize: 22, fontWeight: 500, marginBottom: 4 }}>Тексты экранов</h1>
      <p style={{ color: ADMIN.ink500, fontSize: 13, marginBottom: 20, maxWidth: 720 }}>
        Правка текстовок мини-аппа без релиза. Изменения применяются ко всем
        пользователям выбранного языка. «Оригинал» — значение из кода; «Сбросить»
        возвращает строку к оригиналу. Значения вариантов ответов (списки) правятся
        отдельно и здесь пока недоступны.
      </p>
      <ContentEditor data={data} locales={LOCALES as readonly Locale[]} />
    </OpsShell>
  );
}
