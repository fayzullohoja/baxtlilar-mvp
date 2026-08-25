"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { V2AnketaSelfForm } from "./AnketaSelfForm";
import { V2AnketaValuesForm } from "./AnketaValuesForm";
import { V2AnketaFamilyModelForm } from "./AnketaFamilyModelForm";
import { V2AnketaFinanceForm } from "./AnketaFinanceForm";
import { V2AnketaLifestyleForm } from "./AnketaLifestyleForm";
import { V2AnketaHealthForm } from "./AnketaHealthForm";
import { V2AnketaAppearanceForm } from "./AnketaAppearanceForm";
import { V2AnketaParentsForm } from "./AnketaParentsForm";
import { V2AnketaBirthPlaceForm } from "./AnketaBirthPlaceForm";
import { V2AnketaMarriageForm } from "./AnketaMarriageForm";
import { V2AnketaFamilyForm } from "./AnketaFamilyForm";
import { V2AnketaPartnerExtendedForm } from "./AnketaPartnerExtendedForm";
import type { EditSectionKey } from "@/lib/profile/edit-sections";

/**
 * Редактор собственной анкеты - один экран, разделами.
 *
 * Почему разделами, а не мастером «Далее-Далее». Мастер уместен один раз, при
 * первом заполнении: там человек не знает, что впереди, и его ведут. Правка -
 * противоположная задача: человек точно знает, ЧТО хочет поменять, и ведут
 * здесь его же. Заставлять прощёлкать семнадцать шагов ради смены города -
 * издевательство. Поэтому разделы открываются по одному, каждый сохраняется
 * сам, и после сохранения человек остаётся на месте.
 *
 * Формы внутри - ТЕ ЖЕ САМЫЕ, что в анкете, просто нацеленные на другую ручку.
 * Это не экономия, а требование корректности: своя версия каждой формы означала
 * бы две реализации логики «покажи это поле, если выбрано то», два набора
 * проверок и неизбежное расхождение между ними. Формам добавлено ровно два
 * необязательных свойства - адрес и подпись кнопки.
 *
 * Открыт всегда один раздел. Так экран остаётся коротким, а главное - видно,
 * что именно сейчас правится: две открытые формы с двумя кнопками «Сохранить»
 * читаются как одна большая форма и провоцируют потерю данных.
 */

export type EditorInitial = Record<string, unknown>;

type Props = {
  locale: string;
  /** Значения по разделам: колонки профиля, слитые со своей секцией extended. */
  initial: Record<EditSectionKey, EditorInitial>;
  /** Паспортные поля - показываем, но править нельзя. */
  locked: { full_name: string; birth_date: string | null; gender: string | null };
};

/**
 * Формы объявляют `initial` каждая своим типом. Приводим один раз и здесь, а не
 * в двенадцати местах: значения приходят из базы как Record, и разбирать их по
 * двенадцати интерфейсам ради присваивания - работа без пользы.
 */
function asInitial<T>(v: EditorInitial): T {
  return v as T;
}

const SECTIONS: readonly EditSectionKey[] = [
  "self",
  "appearance",
  "birth_place",
  "family",
  "marriage",
  "parents",
  "values",
  "family_model",
  "finance",
  "lifestyle",
  "health",
  "partner",
];

export function ProfileEditor({ locale, initial, locked }: Props) {
  const t = useTranslations("ProfileEdit");
  // Три раздела - семейное положение, взгляды на брак и модель семьи - звучат
  // по-разному для мужчины и женщины, поэтому формам нужен пол. Берём его из
  // паспортного блока: он неизменяем, значит и подмены не будет.
  const gender = (locked.gender === "m" || locked.gender === "f" ? locked.gender : null) as
    | "m"
    | "f"
    | null;
  const [openKey, setOpenKey] = useState<EditSectionKey | null>(null);

  function endpointFor(k: EditSectionKey): string {
    return `/api/profile/edit/${k}`;
  }

  function renderForm(k: EditSectionKey) {
    const p = { locale, endpoint: endpointFor(k), submitLabel: t("save") };
    switch (k) {
      case "self":
        return <V2AnketaSelfForm {...p} initial={asInitial(initial.self)} />;
      case "appearance":
        return <V2AnketaAppearanceForm {...p} initial={asInitial(initial.appearance)} />;
      case "birth_place":
        return <V2AnketaBirthPlaceForm {...p} initial={asInitial(initial.birth_place)} />;
      case "family":
        return <V2AnketaFamilyForm {...p} gender={gender} initial={asInitial(initial.family)} />;
      case "marriage":
        return <V2AnketaMarriageForm {...p} gender={gender} initial={asInitial(initial.marriage)} />;
      case "parents":
        return <V2AnketaParentsForm {...p} initial={asInitial(initial.parents)} />;
      case "values":
        return <V2AnketaValuesForm {...p} initial={asInitial(initial.values)} />;
      case "family_model":
        return <V2AnketaFamilyModelForm {...p} gender={gender} initial={asInitial(initial.family_model)} />;
      case "finance":
        return <V2AnketaFinanceForm {...p} initial={asInitial(initial.finance)} />;
      case "lifestyle":
        return <V2AnketaLifestyleForm {...p} initial={asInitial(initial.lifestyle)} />;
      case "health":
        return <V2AnketaHealthForm {...p} initial={asInitial(initial.health)} />;
      case "partner":
        return <V2AnketaPartnerExtendedForm {...p} initial={asInitial(initial.partner)} />;
    }
  }

  return (
    <div>
      {/* Паспортный блок. Показываем именно ПОКАЗЫВАЕМ, а не прячем: человек
          должен видеть, что о нём знает приложение, и понимать, почему это
          нельзя поправить самому. Молча отсутствующее поле читается как
          недоработка, объяснённый запрет - как порядок. */}
      <div
        style={{
          border: "1px solid var(--color-v2-border)",
          borderRadius: "var(--v2-radius-card)",
          background: "var(--color-v2-paper-2)",
          padding: 16,
          marginBottom: 18,
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--color-v2-ink-400)",
            marginBottom: 10,
            fontFamily: "var(--font-v2-body)",
          }}
        >
          {t("locked_title")}
        </div>
        <dl style={{ margin: 0, fontFamily: "var(--font-v2-body)", fontSize: 14 }}>
          {[
            [t("locked_name"), locked.full_name || "—"],
            [t("locked_birth"), locked.birth_date ?? "—"],
            [t("locked_gender"), locked.gender ? t(`gender_${locked.gender}`) : "—"],
          ].map(([k, v]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
              <dt style={{ color: "var(--color-v2-ink-400)" }}>{k}</dt>
              <dd style={{ margin: 0, color: "var(--color-v2-ink-100)" }}>{v}</dd>
            </div>
          ))}
        </dl>
        <p
          style={{
            margin: "10px 0 0",
            fontSize: 12.5,
            lineHeight: 1.45,
            color: "var(--color-v2-ink-400)",
            fontFamily: "var(--font-v2-body)",
          }}
        >
          {t("locked_note")}
        </p>
      </div>

      {SECTIONS.map((k) => {
        const isOpen = openKey === k;
        return (
          <div
            key={k}
            style={{
              border: `1px solid ${isOpen ? "var(--color-v2-accent)" : "var(--color-v2-border)"}`,
              borderRadius: "var(--v2-radius-card)",
              background: "var(--color-v2-paper)",
              marginBottom: 10,
              overflow: "hidden",
            }}
          >
            <button
              onClick={() => setOpenKey(isOpen ? null : k)}
              aria-expanded={isOpen}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                width: "100%",
                padding: "16px 18px",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                textAlign: "left",
                fontFamily: "var(--font-v2-body)",
              }}
            >
              <span style={{ fontSize: 15.5, color: "var(--color-v2-ink-100)" }}>
                {t(`section_${k}`)}
              </span>
              <span
                aria-hidden
                style={{
                  fontSize: 13,
                  color: "var(--color-v2-ink-400)",
                  transform: isOpen ? "rotate(180deg)" : "none",
                  transition: "transform 180ms cubic-bezier(0.23, 1, 0.32, 1)",
                }}
              >
                ▾
              </span>
            </button>
            {isOpen ? (
              <div style={{ padding: "0 18px 18px" }}>{renderForm(k)}</div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
