"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { Button } from "./Button";
import { Field, Select, Chips, TextInput } from "./AnketaFields";
import { LANGUAGES_LIST } from "@/lib/profile/options";

/**
 * V2 ext 2026-06-28: новый шаг анкеты — рост / вес / родной язык / владею.
 * Между basic и family. API: /api/onboarding/profile/appearance.
 *
 * Вес — soft optional поле (anti drop-off). Поле явно помечено "можно пропустить".
 */
export function V2AnketaAppearanceForm({ locale }: { locale: string }) {
  const router = useRouter();
  const t = useTranslations("Anketa");
  const [heightCm, setHeightCm] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [nativeLang, setNativeLang] = useState("");
  const [spokenLangs, setSpokenLangs] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function toggleLang(v: string) {
    setSpokenLangs((cur) =>
      cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v],
    );
  }

  async function submit() {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      const hcm = Number(heightCm);
      const wkg = weightKg.trim() === "" ? null : Number(weightKg);
      const body = {
        height_cm: hcm,
        ...(wkg !== null ? { weight_kg: wkg } : {}),
        native_language: nativeLang,
        languages: spokenLangs,
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

  const heightOk =
    heightCm !== "" && Number(heightCm) >= 140 && Number(heightCm) <= 220;
  // Вес optional — без него тоже валидно.
  const weightOk =
    weightKg.trim() === "" ||
    (Number(weightKg) >= 35 && Number(weightKg) <= 200);
  const valid =
    heightOk &&
    weightOk &&
    !!nativeLang &&
    spokenLangs.length >= 1 &&
    spokenLangs.length <= 6;

  return (
    <div>
      <Field
        label={t("heightLabel")}
        required
        hint={t("heightHint")}
      >
        <TextInput
          maxLength={3}
          value={heightCm}
          onChange={(e) => setHeightCm(e.target.value.replace(/\D/g, ""))}
          placeholder={t("heightLabel").match(/\d+/) ? "170" : "170"}
        />
      </Field>

      <Field
        label={t("weightLabel")}
        hint={t("optionalFieldHint")}
      >
        <TextInput
          maxLength={3}
          value={weightKg}
          onChange={(e) => setWeightKg(e.target.value.replace(/\D/g, ""))}
          placeholder=""
        />
      </Field>

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
        hint={`${t("spokenLanguagesLabel").substring(0, 20)}... Выбрано: ${spokenLangs.length}/6`}
      >
        <Chips
          options={LANGUAGES_LIST}
          selected={spokenLangs}
          onToggle={toggleLang}
          max={6}
          locale={locale}
        />
      </Field>

      {err ? (
        <div
          style={{
            padding: "10px 14px",
            background: "rgba(180, 50, 50, 0.08)",
            border: "1px solid rgba(180, 50, 50, 0.3)",
            borderRadius: "var(--v2-radius-md)",
            fontSize: "13px",
            color: "var(--color-v2-ink-200)",
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
