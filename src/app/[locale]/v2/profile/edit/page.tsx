import { setRequestLocale, getTranslations } from "next-intl/server";
import { requireActiveUser } from "@/lib/auth/active-guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getUnreadTotal } from "@/lib/chat/list";
import { BottomNav } from "@/components/bottom-nav";
import { MiniAppShell } from "@/components/v2/MiniAppShell";
import { Headline } from "@/components/v2/Headline";
import { ProfileEditor, type EditorInitial } from "@/components/v2/ProfileEditor";
import { EDIT_SECTIONS, type EditSectionKey } from "@/lib/profile/edit-sections";

export const dynamic = "force-dynamic";

/**
 * «Мой профиль» - правка собственной анкеты.
 *
 * Закрывает дыру, о которой экран настроек честно писал сам: «Edit-flow для
 * анкеты - пока редиректит в re-flow онбординга». То есть поменять город или
 * работу было нельзя вовсе, а обходной путь означал прощёлкать семнадцать
 * шагов заново.
 *
 * Значения для форм собираются здесь: у каждого раздела своя часть в колонках
 * профиля и своя секция в JSON-блоке extended. Форме нужен один плоский объект,
 * поэтому сливаем - колонки под низ, секция сверху (в extended лежат уточнения
 * вроде specialty, которых нет отдельной колонкой).
 */
export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  // allowPaused: на паузе человек не в подборе, но свою анкету правит свободно.
  const user = await requireActiveUser(locale, { allowPaused: true });
  const t = await getTranslations("ProfileEdit");

  const { data: prof } = await supabaseAdmin()
    .from("user_profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  const columns = (prof ?? {}) as Record<string, unknown>;
  const ext = (columns.extended as Record<string, unknown>) ?? {};

  const initial = Object.fromEntries(
    (Object.keys(EDIT_SECTIONS) as EditSectionKey[]).map((k) => {
      const section = (ext[EDIT_SECTIONS[k].extendedKey] as Record<string, unknown>) ?? {};
      // Колонки под низ, уточнения из extended сверху: если поле есть и там, и
      // там, свежее лежит в секции.
      return [k, { ...columns, ...section } as EditorInitial];
    }),
  ) as Record<EditSectionKey, EditorInitial>;

  const unread = await getUnreadTotal(user.id);

  return (
    <>
      <MiniAppShell eyebrow={t("eyebrow")} align="top" showBack>
        <Headline>{t("title")}</Headline>
        <p
          style={{
            margin: "6px 0 20px",
            fontSize: 14,
            lineHeight: 1.5,
            color: "var(--color-v2-ink-300)",
            fontFamily: "var(--font-v2-body)",
          }}
        >
          {t("lead")}
        </p>
        <ProfileEditor
          locale={locale}
          initial={initial}
          locked={{
            full_name: (columns.display_name as string) ?? "",
            birth_date: (columns.birth_date as string) ?? null,
            gender: (columns.gender as string) ?? null,
          }}
        />
      </MiniAppShell>
      <BottomNav active="profile" unread={unread} />
    </>
  );
}
