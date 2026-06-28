# Onboarding V2 Extension — Product Updates 2026-06-28

> Источник: встреча учредителя с продакт-командой 2026-06-28. Решения приняты Head of Product (Claude) с свободой действий.

**Goal:** 5 продуктовых поправок в V2 онбординг: (1) welcome серия из 3 экранов перед verify, (2) гражданство/страна/регион проживания в анкете, (3) демография (рост/вес/языки), (4) переработка вопроса о религии без шкалы «не важна → важна», (5) формат проживания после брака.

**Architecture:**
- 1 миграция БД — 9 новых колонок в `user_profiles` + 4 значения в `onboarding_step` enum
- State machine: новые шаги `welcome_safety`, `welcome_rules`, `profile_appearance`, `profile_marriage`
- API: 2 новых endpoint (appearance, marriage) + расширение basic + переработка values
- UI: 2 новых welcome (`/v2/welcome/safety`, `/v2/welcome/rules`) + 2 новых анкета (`/v2/anketa/appearance`, `/v2/anketa/marriage`) + правки basic/values

**Итоговая структура онбординга:**

```
welcome (3 экрана)         → новое: mission → safety → rules
verify (3 экрана)          → без изменений: intro → doc → selfie
anketa (8 шагов)            → basic+ → appearance(new) → family → values+ → marriage(new) → looking-for → photos → preview
quiz → attribution → tutorial(4) → /main
```

**Tech Stack:** наследуется из V2 Sprint 1 — Next.js 16 App Router · React 19 · TS strict · нативный Postgres · Vitest · editorial DNA (paper, serif, no Tinder tropes).

## Global Constraints

- Никаких изменений admin / matching сейчас — только V2 онбординг и user_profiles.
- `religion_importance` (старая integer шкала) остаётся в БД для legacy; новые поля `religion_practice` и `religion_partner_match` заменяют её в UI.
- Вес `weight_kg` — **строго optional**, скрытый «можно пропустить» (anti-drop-off).
- Все формы — native React `useState` + fetch, no Zod, no react-hook-form (стиль кодовой базы).
- Все новые экраны — editorial DNA (paper #FAF6F1, serif Headlines, sans body).
- Каждая фаза = коммит.

## Phases

### Phase A — DB migration
Один SQL файл `20260628000000_onboarding_v2_extension.sql`:
- ALTER TYPE onboarding_step ADD VALUE: welcome_safety, welcome_rules, profile_appearance, profile_marriage
- ALTER TABLE user_profiles ADD COLUMN: citizenship, country_of_residence, region, height_cm (CHECK 140-220), weight_kg (CHECK 35-200), native_language, religion_practice, religion_partner_match, post_marriage_living
- `languages` text[] оставляем — используется как «языки общения»

### Phase B — State machine + options
- `src/lib/state-machine/transitions.ts` — добавить ALLOWED_TRANSITIONS:
  - welcome_mission (текущий welcome) → welcome_safety → welcome_rules → verification_intro
  - basic → appearance → family
  - values → marriage → looking_for
- `src/lib/profile/options.ts` — добавить наборы COUNTRIES_CIS, UZ_REGIONS, LANGUAGES_LIST, RELIGION_PRACTICE, RELIGION_PARTNER_MATCH, POST_MARRIAGE_LIVING

### Phase C — API onboarding endpoints
- `POST /api/onboarding/profile/basic` — расширить body: citizenship, country_of_residence, region (опц для не-UZ)
- `POST /api/onboarding/profile/appearance` (NEW) — height_cm, weight_kg, native_language, languages[]
- `POST /api/onboarding/profile/values` — заменить religion_importance на religion_practice + опционально religion_partner_match
- `POST /api/onboarding/profile/marriage` (NEW) — post_marriage_living

### Phase D — Welcome series (3 screens)
- `src/app/[locale]/v2/welcome/page.tsx` — переписать как welcome_mission (тёплое приветствие + миссия, CTA → safety)
- `src/app/[locale]/v2/welcome/safety/page.tsx` (NEW) — verified + модерация + приватность фото
- `src/app/[locale]/v2/welcome/rules/page.tsx` (NEW) — взаимность интересов + mutual чаты + что делать если что-то не так
- `src/app/api/onboarding/welcome/route.ts` (NEW) — POST переключает state-machine между welcome шагами

### Phase E — New anketa steps
- `/v2/anketa/appearance` — `V2AnketaAppearanceForm` (4 поля)
- `/v2/anketa/marriage` — `V2AnketaMarriageForm` (1 поле, 5 опций)

### Phase F — Update basic + values forms
- `V2AnketaBasicForm` — добавить citizenship + country + region (cascading для UZ)
- `V2AnketaValuesForm` — убрать NumberScale «важность», заменить на 2 Select (practice + partner_match)

### Phase G — Verify
- `npx vitest run` зелёный
- `pnpm tsc --noEmit` clean
- `pnpm build` clean
- Manual smoke на ngrok-туннеле или CDP
- Push на `feat/onboarding-v2-extension` → PR / merge решает учредитель

## Status

- [ ] Phase A · DB
- [ ] Phase B · State + options
- [ ] Phase C · APIs
- [ ] Phase D · Welcome series
- [ ] Phase E · New anketa
- [ ] Phase F · Update existing
- [ ] Phase G · Verify
