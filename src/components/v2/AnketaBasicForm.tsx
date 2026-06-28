"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "./Button";
import { Field, TextInput, Select } from "./AnketaFields";
import {
  GENDER,
  CITIZENSHIP,
  COUNTRY_OF_RESIDENCE,
  UZ_REGIONS,
} from "@/lib/profile/options";

/**
 * V2 Anketa Basic form (Blueprint §3.3 B1).
 * Поля: имя, пол, дата рождения, гражданство, страна проживания, регион (UZ),
 * город, bio.
 * API: /api/onboarding/profile/basic.
 *
 * V2 ext 2026-06-28: добавлены citizenship + country_of_residence + region.
 * Гражданство и страна проживания могут не совпадать (UZ-гражданин в РФ).
 * При approve паспорта в админке citizenship сверяется с user_identity.
 */

const ERR_COPY: Record<string, string> = {
  bio_has_contacts: "В тексте нашёлся контакт (телефон, ник, ссылка). Удали — здесь это не работает.",
  name_has_contacts: "В имени нашёлся контакт. Только имя без ссылок.",
  bio_too_short: "Расскажи побольше — минимум 20 символов.",
  bio_too_long: "Слишком длинно — максимум 1000 символов.",
  must_be_18: "Возраст должен быть 18 лет и больше.",
  invalid_age: "Проверь дату рождения.",
  region_required_for_uz: "Для проживания в Узбекистане выбери область или город.",
  validation: "Проверь заполненные поля.",
  failed: "Не получилось сохранить. Попробуй ещё раз.",
};

export function V2AnketaBasicForm({
  defaultName,
  locale,
}: {
  defaultName?: string;
  locale: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(defaultName ?? "");
  const [gender, setGender] = useState("");
  const [birth, setBirth] = useState("");
  // V2 ext 2026-06-28: гражданство + страна проживания + регион.
  const [citizenship, setCitizenship] = useState("");
  const [country, setCountry] = useState("");
  const [region, setRegion] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Region виден только если выбрано проживание в UZ.
  const showRegion = country === "UZ";

  async function submit() {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/onboarding/profile/basic", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          display_name: name,
          gender,
          birth_date: birth,
          citizenship,
          country_of_residence: country,
          ...(showRegion ? { region } : {}),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok: boolean;
        next?: string;
        detail?: string;
        error?: string;
      };
      if (data.ok && data.next) {
        router.replace(data.next);
        return;
      }
      setErr(data.detail ?? data.error ?? "failed");
    } catch {
      setErr("failed");
    } finally {
      setBusy(false);
    }
  }

  const valid =
    name.trim().length >= 2 &&
    !!gender &&
    !!birth &&
    !!citizenship &&
    !!country &&
    (!showRegion || !!region);

  return (
    <div>
      <Field label="Имя">
        <TextInput
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={50}
          placeholder="Так тебя увидят другие"
        />
      </Field>
      <Field label="Пол">
        <Select options={GENDER} value={gender} onChange={setGender} locale={locale} />
      </Field>
      <Field label="Дата рождения">
        <TextInput type="date" value={birth} onChange={(e) => setBirth(e.target.value)} />
      </Field>
      <Field
        label="Гражданство"
        hint="То, что написано в&nbsp;паспорте. Сверим при верификации."
      >
        <Select
          options={CITIZENSHIP}
          value={citizenship}
          onChange={setCitizenship}
          locale={locale}
        />
      </Field>
      <Field
        label="Где живёшь сейчас"
        hint="Может отличаться от&nbsp;гражданства — например UZ-гражданин в&nbsp;Москве."
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
      {showRegion ? (
        <Field
          label="Область или регион"
          hint="Где живёшь сейчас — этого достаточно для подбора."
        >
          <Select
            options={UZ_REGIONS}
            value={region}
            onChange={setRegion}
            locale={locale}
          />
        </Field>
      ) : null}

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
            marginBottom: "16px",
            lineHeight: "1.5",
          }}
        >
          {ERR_COPY[err] ?? ERR_COPY.failed}
        </div>
      ) : null}

      <Button onClick={submit} disabled={busy || !valid} variant="primary">
        {busy ? "Сохраняю…" : "Дальше"}
      </Button>
    </div>
  );
}
