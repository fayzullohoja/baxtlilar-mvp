"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { Button } from "./Button";
import { Field, Select, Chips, TextInput } from "./AnketaFields";
import { LANGUAGES_LIST, type Opt } from "@/lib/profile/options";

/**
 * V2 ext 2026-06-28 → ревью оунера Экран 2: рост (range-picker, ОПЦИОНАЛЬНО) /
 * вес (скрыт за тоглом, optional) / родной язык / владею + свободный ввод «Другой».
 * Между basic и family. API: /api/onboarding/profile/appearance.
 */

// Ревью оунера: рост — picker, не ручной ввод. 140–220 см.
const HEIGHT_OPTIONS: Opt[] = Array.from({ length: 81 }, (_, i) => {
  const cm = 140 + i;
  return { value: String(cm), ru: `${cm} см`, uz: `${cm} sm` };
});

export function V2AnketaAppearanceForm({ locale }: { locale: string }) {
  const router = useRouter();
  const t = useTranslations("Anketa");
  const [heightCm, setHeightCm] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [showWeight, setShowWeight] = useState(false);
  const [nativeLang, setNativeLang] = useState("");
  const [spokenLangs, setSpokenLangs] = useState<string[]>([]);
  const [otherLanguage, setOtherLanguage] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function toggleLang(v: string) {
    setSpokenLangs((cur) =>
      cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v],
    );
  }

  const showOtherLang = spokenLangs.includes("other") || nativeLang === "other";

  async function submit() {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      const wkg = weightKg.trim() === "" ? null : Number(weightKg);
      const body: Record<string, unknown> = {
        native_language: nativeLang,
        languages: spokenLangs,
        // Рост опционален (ревью оунера) — отправляем только если выбран.
        ...(heightCm !== "" ? { height_cm: Number(heightCm) } : {}),
        ...(wkg !== null ? { weight_kg: wkg } : {}),
        ...(showOtherLang && otherLanguage.trim()
          ? { other_language: otherLanguage.trim() }
          : {}),
      };
      const res = await fetch("/api/onboarding/profile/appearance", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok: boolean;
        next?: string;
      };
      if (data.ok && data.next) {
        router.replace(data.next);
        return;
      }
      setErr("failed");
    } catch {
      setErr("failed");
    } finally {
      setBusy(false);
    }
  }

  // Рост необязателен (picker гарантирует диапазон). Вес — optional.
  const weightOk =
    weightKg.trim() === "" ||
    (Number(weightKg) >= 35 && Number(weightKg) <= 200);
  const valid =
    weightOk &&
    !!nativeLang &&
    spokenLangs.length >= 1 &&
    spokenLangs.length <= 6;

  return (
    <div>
      <Field
        label={t("nativeLanguageLabel")}
        required
        hint={t("nativeLanguageHint")}
      >
        <Select
          options={LANGUAGES_LIST}
          value={nativeLang}
          onChange={setNativeLang}
          locale={locale}
        />
      </Field>

      <Field
        label={t("spokenLanguagesLabel")}
        required
        hint={t("spokenLanguagesHint", { count: spokenLangs.length })}
      >
        <Chips
          options={LANGUAGES_LIST}
          selected={spokenLangs}
          onToggle={toggleLang}
          max={6}
          locale={locale}
        />
      </Field>

      {showOtherLang ? (
        <Field label={t("otherLanguageLabel")} hint={t("optionalHint")}>
          <TextInput
            value={otherLanguage}
            onChange={(e) => setOtherLanguage(e.target.value)}
            maxLength={60}
            placeholder={t("otherLanguagePlaceholder")}
          />
        </Field>
      ) : null}

      <Field label={t("heightLabel")} hint={t("heightHint")}>
        <Select
          options={HEIGHT_OPTIONS}
          value={heightCm}
          onChange={setHeightCm}
          locale={locale}
          placeholder="—"
        />
      </Field>

      {/* Ревью оунера: вес скрыт по умолчанию, раскрывается по желанию. */}
      {showWeight ? (
        <Field label={t("weightLabel")} hint={t("weightHiddenHint")}>
          <TextInput
            maxLength={3}
            value={weightKg}
            onChange={(e) => setWeightKg(e.target.value.replace(/\D/g, ""))}
            placeholder=""
          />
        </Field>
      ) : (
        <button
          type="button"
          onClick={() => setShowWeight(true)}
          style={{
            background: "none",
            border: "none",
            color: "var(--color-v2-accent)",
            fontFamily: "var(--font-v2-body)",
            fontSize: "13px",
            fontWeight: 600,
            cursor: "pointer",
            padding: "4px 0 16px",
          }}
        >
          + {t("weightAddButton")}
        </button>
      )}

      {err ? (
        <div
          style={{
            padding: "10px 14px",
            background: "#FBE7E4",
            borderLeft: "3px solid var(--color-v2-danger)",
            borderRadius: "12px",
            fontSize: "13px",
            color: "#9A4B46",
            fontFamily: "var(--font-v2-body)",
            marginBottom: "24px",
          }}
        >
          {t("err_failed")}
        </div>
      ) : null}

      <Button
        variant="primary"
        onClick={submit}
        disabled={!valid || busy}
        style={{ width: "100%" }}
      >
        {busy ? t("btn_saving") : t("btn_next")}
      </Button>
    </div>
  );
}
