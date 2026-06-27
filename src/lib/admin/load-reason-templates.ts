import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { unwrapRows } from "@/lib/db/unwrap";

/**
 * Шаблоны причин решений из admin_reason_templates (DB-управляемые, RU/UZ).
 * Заменяет захардкоженные RU-строки в компонентах — модератор-узбек видит
 * узбекские причины, тексты правит super-админ без релиза.
 */
export async function loadReasonTemplates(
  scope: "verification" | "photo" | "report",
  lang: "ru" | "uz" = "ru",
): Promise<{ code: string; text: string }[]> {
  const rows = unwrapRows(
    await supabaseAdmin()
      .from("admin_reason_templates")
      .select("code, text, sort")
      .eq("scope", scope)
      .eq("lang", lang)
      .eq("active", true)
      .order("sort", { ascending: true }),
  );
  return rows.map((r) => ({
    code: r.code as string,
    text: r.text as string,
  }));
}
