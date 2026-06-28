"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "./Button";
import { Field, Select, TextInput } from "./AnketaFields";
import { COUNTRY_OF_RESIDENCE, UZ_REGIONS } from "@/lib/profile/options";

/**
 * V3 Sprint 1 — Экран 2 «Место рождения / родной регион».
 * 4 поля: страна (required), регион / район / город (опц).
 * Для UZ — Select из UZ_REGIONS; для остальных стран — freeform input.
 * API: /api/onboarding/profile/birth-place.
 */
export function V2AnketaBirthPlaceForm({ locale }: { locale: string }) {
  const router = useRouter();
  const [country, setCountry] = useState("UZ");
  const [region, setRegion] = useState("");
  const [district, setDistrict] = useState("");
  const [city, setCity] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const showUzRegions = country === "UZ";

  async function submit() {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/onboarding/profile/birth-place", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          birth_country: country,
          birth_region: region.trim() || undefined,
          birth_district: district.trim() || undefined,
          birth_city: city.trim() || undefined,
        }),
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
        label="Страна рождения"
        required
        hint="Где ты родился(ась). Может отличаться от текущего места проживания."
      >
        <Select
          options={COUNTRY_OF_RESIDENCE}
          value={country}
          onChange={(v) => {
            setCountry(v);
            if (v !== "UZ") setRegion("");
          }}
          locale={locale}
        />
      </Field>

      {showUzRegions ? (
        <Field label="Область / регион">
          <Select
            options={UZ_REGIONS}
            value={region}
            onChange={setRegion}
            locale={locale}
          />
        </Field>
      ) : (
        <Field
          label="Область / регион"
          hint="Опционально — можно пропустить."
        >
          <TextInput
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            maxLength={128}
            placeholder=""
          />
        </Field>
      )}

      <Field
        label="Район"
        hint="Если знаешь — это помогает культурной совместимости. Можно пропустить."
      >
        <TextInput
          value={district}
          onChange={(e) => setDistrict(e.target.value)}
          maxLength={128}
          placeholder=""
        />
      </Field>

      <Field
        label="Город или населённый пункт"
        hint="Город рождения. Можно пропустить."
      >
        <TextInput
          value={city}
          onChange={(e) => setCity(e.target.value)}
          maxLength={128}
          placeholder=""
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
          Не получилось сохранить. Попробуй ещё раз.
        </div>
      ) : null}

      <Button
        variant="primary"
        onClick={submit}
        disabled={!country || busy}
        style={{ width: "100%" }}
      >
        {busy ? "Сохраняем…" : "Дальше"}
      </Button>
    </div>
  );
}
