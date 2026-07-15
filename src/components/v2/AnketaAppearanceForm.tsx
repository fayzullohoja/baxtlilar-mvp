"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { Button } from "./Button";
import { Field, Select, Chips, TextInput, RangeSlider, scrollToFirstError } from "./AnketaFields";
import { LANGUAGES_LIST } from "@/lib/profile/options";

/**
 * V2 ext 2026-06-28 → ревью оунера Экран 2: рост (ползунок, ОПЦИОНАЛЬНО) /
 * вес (ползунок, optional) / родной язык / владею + свободный ввод «Другой».
 * Рост/вес — интерактивные RangeSlider со состоянием «не указано».
 * Между basic и family. API: /api/onboarding/profile/appearance.
 */

// Диапазоны ползунков (совпадают со схемой: рост 140–220, вес 35–200).
const HEIGHT_MIN = 140;
const HEIGHT_MAX = 220;
const HEIGHT_MID = 170;
const WEIGHT_MIN = 40;
const WEIGHT_MAX = 150;
const WEIGHT_MID = 70;

export function V2AnketaAppearanceForm({
  locale,
  initial,
}: {
  locale: string;
  initial?: {
    height_cm?: number;
    weight_kg?: number;
    native_language?: string;
    languages?: string[];
    other_language?: string;
  };
}) {
  const router = useRouter();
  const t = useTranslations("Anketa");
  const hasHeight = typeof initial?.height_cm === "number";
  const hasWeight = typeof initial?.weight_kg === "number";
  const [heightCm, setHeightCm] = useState(initial?.height_cm ?? HEIGHT_MID);
  const [heightSet, setHeightSet] = useState(hasHeight);
  const [weightKg, setWeightKg] = useState(initial?.weight_kg ?? WEIGHT_MID);
  const [weightSet, setWeightSet] = useState(hasWeight);
  // Вес — чувствительное поле: скрыт за кнопкой, раскрывается ползунком (ревью оунера).
  // Если вес уже сохранён, раскрываем блок сразу, чтобы «Назад» показал значение.
  const [showWeight, setShowWeight] = useState(hasWeight);
  const [nativeLang, setNativeLang] = useState(initial?.native_language ?? "");
  const [spokenLangs, setSpokenLangs] = useState<string[]>(
    initial?.languages ?? [],
  );
  const [otherLanguage, setOtherLanguage] = useState(
    initial?.other_language ?? "",
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);

  // §2 P0: эквивалент прежнего valid (nativeLang + spokenLangs 1-6; рост/вес опц.).
  const errors: Record<string, string> = {};
  if (!nativeLang) errors.native_language = t("err_select_required");
  if (spokenLangs.length < 1) errors.languages = t("err_select_required");

  function toggleLang(v: string) {
    setSpokenLangs((cur) =>
      cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v],
    );
  }

  const showOtherLang = spokenLangs.includes("other") || nativeLang === "other";

  async function submit() {
    if (busy) return;
    if (Object.keys(errors).length) {
      setShowErrors(true);
      requestAnimationFrame(scrollToFirstError);
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const body: Record<string, unknown> = {
        native_language: nativeLang,
        languages: spokenLangs,
        // Рост/вес опциональны — отправляем только если ползунок «указан».
        ...(heightSet ? { height_cm: heightCm } : {}),
        ...(showWeight && weightSet ? { weight_kg: weightKg } : {}),
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

  return (
    <div>
      <Field
        label={t("nativeLanguageLabel")}
        required
        hint={t("nativeLanguageHint")}
        error={showErrors ? errors.native_language : undefined}
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
        error={showErrors ? errors.languages : undefined}
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
        <RangeSlider
          min={HEIGHT_MIN}
          max={HEIGHT_MAX}
          mid={HEIGHT_MID}
          value={heightCm}
          isSet={heightSet}
          onChange={(v, set) => {
            setHeightCm(v);
            setHeightSet(set);
          }}
          unit={t("unitCm")}
          notSetLabel={t("notSpecified")}
          clearLabel={t("clearValue")}
        />
      </Field>

      {/* Ревью оунера: вес скрыт по умолчанию, раскрывается ползунком по желанию. */}
      {showWeight ? (
        <Field label={t("weightLabel")} hint={t("weightHiddenHint")}>
          <RangeSlider
            min={WEIGHT_MIN}
            max={WEIGHT_MAX}
            mid={WEIGHT_MID}
            value={weightKg}
            isSet={weightSet}
            onChange={(v, set) => {
              setWeightKg(v);
              setWeightSet(set);
            }}
            unit={t("unitKg")}
            notSetLabel={t("notSpecified")}
            clearLabel={t("clearValue")}
          />
        </Field>
      ) : (
        <button
          type="button"
          onClick={() => {
            setShowWeight(true);
            setWeightSet(true);
          }}
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
        disabled={busy}
        style={{ width: "100%" }}
      >
        {busy ? t("btn_saving") : t("btn_next")}
      </Button>
    </div>
  );
}
