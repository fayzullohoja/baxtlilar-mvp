# Коды-приглашения: план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Закрыть вход в Baxtlilar кодом-приглашением: без кода онбординг не пройти, и в базе видно, кто кого привёл.

**Architecture:** Новый шаг стейт-машины `bot_invite_code` между `bot_language` и `bot_consent_pd`. Коды живут в отдельной таблице `invite_codes`, привязка к человеку - четырьмя полями в `users`. Шлагбаум включается существующим механизмом фича-флагов (`app_settings`), по умолчанию ВЫКЛЮЧЕН.

**Tech Stack:** Next.js 16 App Router, TypeScript, PostgreSQL 18 (самописный адаптер поверх node-pg, поверхность supabase-js), Vitest, Telegram Bot API.

**Спека:** `docs/superpowers/specs/2026-08-11-invite-codes-design.md`

## Global Constraints

- **Тире:** только дефис `-`. Не использовать `—` и `–` ни в текстах, ни в коде, ни в комментариях.
- **Тон:** обращение к пользователю на «Вы».
- **Языки бот-копи:** ru, uz, tr, en - все четыре обязательны (формат `M` в `src/lib/telegram/bot/messages.ts`).
- **Порядок выкладки:** миграция накатывается ДО выкладки кода. Значение enum, использованное кодом раньше, чем оно появилось в БД, роняет прод.
- **Флаг по умолчанию `false`** - выкладка ничего не меняет для живых пользователей.
- **`.upsert()` в адаптере компилируется в `SET col = EXCLUDED.col`** - колонка `extended` заменяется целиком. В этом плане `extended` не трогаем, но правило помнить.
- **Никогда `git add -A`** - добавлять только перечисленные в задаче файлы.
- **Функция `returns table`, забытая в константе `SET_RETURNING`** (`src/lib/db/query-builder.ts`), читается как скаляр и молча ломает роут. В этом плане новых `returns table` нет.

---

### Task 1: Миграция БД

**Files:**
- Create: `supabase/migrations/20260811120000_invite_codes.sql`
- Test: применение на живой копии (шаг 4)

**Interfaces:**
- Produces: значение enum `onboarding_step.bot_invite_code`; таблица `invite_codes(id, code, owner_id, label, disabled_at, disabled_reason, created_at)`; колонки `users.invited_by`, `users.invite_code_id`, `users.invite_redeemed_at`, `users.invite_exempt`.

- [ ] **Step 1: Написать миграцию**

Создать `supabase/migrations/20260811120000_invite_codes.sql`:

**ВНИМАНИЕ:** блок ниже - это ФАКТИЧЕСКИЙ текст файла миграции после доработки
по итогам ревью (первый вариант падал на проде и на локальной пересборке БД -
подробности в `.superpowers/sdd/2026-08-11-invite-codes/task-1-report.md`).
Копировать SQL нужно из самого файла `supabase/migrations/20260811120000_invite_codes.sql`
в репозитории, а не из этого документа - здесь текст продублирован для
контекста и может разойтись с файлом при последующих правках.

```sql
-- Коды-приглашения для закрытого family-запуска.
-- Спека: docs/superpowers/specs/2026-08-11-invite-codes-design.md
--
-- ВАЖНО: новое значение enum нельзя использовать в той же транзакции, где оно
-- добавлено. Здесь оно и не используется - вставка в analytics.funnel_steps идёт
-- текстом, а не enum-значением.

alter type onboarding_step add value if not exists 'bot_invite_code';

create table if not exists invite_codes (
  id              uuid primary key default gen_random_uuid(),
  code            text not null unique,
  owner_id        uuid references users(id) on delete cascade,
  label           text,
  disabled_at     timestamptz,
  disabled_reason text,
  created_at      timestamptz not null default now()
);

comment on table invite_codes is
  'Коды-приглашения. owner_id IS NULL = мастер-код владельца (оффлайн-встречи).';

-- Один АКТИВНЫЙ код на человека. Частичный индекс: после гашения тому же
-- человеку можно выпустить новый, старый остаётся в истории.
create unique index if not exists invite_codes_one_active_per_owner
  on invite_codes(owner_id)
  where owner_id is not null and disabled_at is null;

create index if not exists invite_codes_code_active_idx
  on invite_codes(code) where disabled_at is null;

alter table users
  add column if not exists invited_by         uuid references users(id) on delete set null,
  add column if not exists invite_code_id     uuid references invite_codes(id) on delete set null,
  add column if not exists invite_redeemed_at timestamptz,
  add column if not exists invite_exempt      boolean not null default false;

comment on column users.invite_exempt is
  'Вошёл до включения шлагбаума - шаг кода не показывать.';
comment on column users.invite_redeemed_at is
  'Пусто + заполненный invite_code_id = код из ссылки ждёт своего шага.';

create index if not exists users_invited_by_idx on users(invited_by)
  where invited_by is not null;

-- Все, кто зарегистрировался ДО запуска, проходят по старым правилам.
--
-- Предикат "invite_exempt = false" сам по себе НЕ привязан к моменту наката -
-- это множество "кому ещё предстоит пройти шлагбаум", и оно растёт после
-- запуска новыми пользователями. Без защиты повторный прогон файла (в т.ч.
-- через год, вручную через psql < file - именно так проверяется
-- идемпотентность) молча пометил бы exempt=true и того, кто ПРЯМО СЕЙЧАС
-- стоит на шаге ввода кода - то есть открыл бы вход мимо шлагбаума без
-- единой ошибки и следа в логах.
--
-- Защита - одноразовый маркер в app_settings (тот же паттерн, что
-- feature_*_enabled в миграции 20260724150000): backfill выполняется РОВНО
-- ОДИН РАЗ, при первом накате, и никогда больше - независимо от того, сколько
-- раз файл прогонят позже и сколько новых НЕ-exempt пользователей появится
-- к тому моменту. Отсечка по created_at была бы проще, но зашивала бы в
-- код миграции дату, которую на момент написания файла мы ещё не знаем
-- (точный момент наката на прод) - маркер честнее и не требует гадать дату.
do $$
begin
  if not exists (select 1 from app_settings where key = 'invite_codes_backfill_done') then
    update users set invite_exempt = true where invite_exempt = false;
    insert into app_settings (key, value)
    values ('invite_codes_backfill_done', to_jsonb(now()))
    on conflict (key) do nothing;
  end if;
end $$;

-- Шаг в справочник воронки Grafana, между "Передача контакта" (3) и
-- "Приветственный экран" (4). Существующие ord сдвигаем на 1.
--
-- ord - первичный ключ без DEFERRABLE, поэтому сдвиг на +1 одним запросом
-- ломается на промежуточном дубликате: строка 4 переезжает в 5, а 5 ещё занята.
-- Сдвигаем в два прохода через заведомо свободный диапазон +1000.
--
-- Двойная проверка, ДВУМЯ вложенными IF (не одним AND):
--  - to_regclass - analytics.funnel_steps создана вручную прямо на проде
--    (это отдельная схема для Grafana, вне supabase/migrations), поэтому в
--    локальной/тестовой БД, поднятой только из миграций, её нет - без этой
--    проверки любой локальный rebuild (npm run test:integration) падал бы
--    здесь с "relation analytics.funnel_steps does not exist". Именно
--    вложенным IF, а не "and not exists (...)" одним выражением: PL/pgSQL
--    разбирает подзапрос вложенного IF только при входе в внешнюю ветку,
--    а составное "A and B" разбирается целиком сразу и падает на этапе
--    парсинга, даже если A уже ложно;
--  - not exists (... step = 'bot_invite_code') - сам сдвиг ord не идемпотентен,
--    без неё повторный прогон сдвинул бы воронку ещё раз и молча испортил
--    порядок шагов.
do $$
begin
  if to_regclass('analytics.funnel_steps') is not null then
    if not exists (select 1 from analytics.funnel_steps where step = 'bot_invite_code') then
      update analytics.funnel_steps set ord = ord + 1000 where ord >= 4;
      update analytics.funnel_steps set ord = ord - 999  where ord >= 1004;
      insert into analytics.funnel_steps (ord, step, phase, label)
      values (4, 'bot_invite_code', 'Бот', 'Код приглашения')
      on conflict (step) do nothing;
    end if;
  end if;
end $$;
```

- [ ] **Step 2: Проверить идемпотентность различающим тестом (не просто "нет ошибок")**

"Применяется дважды без ошибок" - недостаточная проверка: до правки backfill
`update users set invite_exempt = true where invite_exempt = false` тоже "не
падал" при повторном прогоне, но при этом молча ломал защиту, если на срезе
уже не было ни одной строки с `invite_exempt = false` (после первого наката
их и не остаётся) - "UPDATE 0" получался бы что с защитой, что без неё,
поэтому такая проверка ничего не различает.

Правильный, различающий тест:

1. Создать синтетического пользователя с `invite_exempt = false` (имитация
   живого юзера, который прямо сейчас стоит на шаге ввода кода):
   ```sql
   insert into users (telegram_id, invite_exempt) values (-900000000001, false);
   ```
2. Прогнать файл миграции повторно напрямую: `psql -d baxtlilar < <файл>`.
3. Убедиться, что у синтетического пользователя `invite_exempt` **осталось
   `false`** (не превратилось в `true`) - это и есть подтверждение, что
   маркер в `app_settings` реально защищает, а не просто "нет ошибок".
4. Удалить синтетического пользователя.

Заодно проверить: `analytics.funnel_steps` после повторного прогона осталась
без изменений (`count/min/max(ord)` те же, что до повтора) - это подтверждает,
что двухпроходный сдвиг с гардом `not exists (... step = 'bot_invite_code')`
не сдвигает воронку второй раз.

- [ ] **Step 3: Накатить на прод ДО выкладки кода**

```bash
ssh baxtlilar-vps
sudo baxtlilar-migrate status   # должна появиться в списке ожидающих
sudo baxtlilar-migrate apply
```

- [ ] **Step 4: Проверить результат на проде**

```bash
sudo -u postgres psql -d baxtlilar -c "\d invite_codes"
sudo -u postgres psql -d baxtlilar -At -c "select count(*) filter (where invite_exempt) || ' из ' || count(*) || ' помечены как вошедшие до запуска' from users"
sudo -u postgres psql -d baxtlilar -At -c "select ord || ' ' || label from analytics.funnel_steps where ord between 3 and 5 order by ord"
```

Ожидаем: таблица есть; помечены **все** существующие (29 из 29); в воронке шаг «Код приглашения» стоит четвёртым.

- [ ] **Step 5: Коммит**

```bash
git add supabase/migrations/20260811120000_invite_codes.sql
git commit -m "feat(db): таблица invite_codes, поля привязки и шаг bot_invite_code"
```

---

### Task 2: Нормализация и генерация кода

Чистые функции без зависимостей - идеальны для TDD и здесь самая ценная логика (кириллица).

**Files:**
- Create: `src/lib/invite/code.ts`
- Test: `src/lib/invite/code.test.ts`

**Interfaces:**
- Produces: `normalizeInviteCode(raw: string): string`, `generateInviteCode(): string`, `INVITE_CODE_ALPHABET: string`, `INVITE_CODE_LENGTH: number`.

- [ ] **Step 1: Написать падающий тест**

Создать `src/lib/invite/code.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  normalizeInviteCode,
  generateInviteCode,
  INVITE_CODE_ALPHABET,
  INVITE_CODE_LENGTH,
} from "./code";

describe("normalizeInviteCode", () => {
  it("поднимает регистр", () => {
    expect(normalizeInviteCode("7k2mqx")).toBe("7K2MQX");
  });

  it("убирает пробелы и дефисы", () => {
    expect(normalizeInviteCode(" 7K2 - MQX ")).toBe("7K2MQX");
  });

  // Главный кейс: в Узбекистане печатают на кириллице, а кириллические
  // В А Е К М Н О Р С Т У Х визуально НЕОТЛИЧИМЫ от латинских.
  it("переводит похожие кириллические буквы в латиницу", () => {
    expect(normalizeInviteCode("ВАХТ7К2М")).toBe("BAXT7K2M");
    expect(normalizeInviteCode("散")).toBe("");
  });

  it("переводит кириллицу в нижнем регистре", () => {
    expect(normalizeInviteCode("вахт7к2м")).toBe("BAXT7K2M");
  });

  it("выбрасывает всё, чего нет в алфавите", () => {
    expect(normalizeInviteCode("7K2@MQX!")).toBe("7K2MQX");
  });

  it("не падает на пустой строке и мусоре", () => {
    expect(normalizeInviteCode("")).toBe("");
    expect(normalizeInviteCode("   ")).toBe("");
    expect(normalizeInviteCode("привет")).toBe("PBET"); // п,р,и,в,е,т -> Р и В Е Т, из них в алфавите B E T + P
  });
});

describe("generateInviteCode", () => {
  it("длина совпадает с константой", () => {
    expect(generateInviteCode()).toHaveLength(INVITE_CODE_LENGTH);
  });

  it("использует только символы алфавита", () => {
    for (let i = 0; i < 200; i++) {
      for (const ch of generateInviteCode()) {
        expect(INVITE_CODE_ALPHABET).toContain(ch);
      }
    }
  });

  it("в алфавите нет похожих символов (0/O, 1/I/L)", () => {
    for (const ch of "01ILO") {
      expect(INVITE_CODE_ALPHABET).not.toContain(ch);
    }
  });

  it("сгенерированный код проходит нормализацию без изменений", () => {
    for (let i = 0; i < 50; i++) {
      const c = generateInviteCode();
      expect(normalizeInviteCode(c)).toBe(c);
    }
  });
});
```

- [ ] **Step 2: Запустить тест, убедиться что падает**

Run: `pnpm vitest run src/lib/invite/code.test.ts`
Expected: FAIL - `Cannot find module './code'`

- [ ] **Step 3: Написать реализацию**

Создать `src/lib/invite/code.ts`:

```ts
/**
 * Коды-приглашения: алфавит, генерация, нормализация ввода.
 *
 * Алфавит без похожих символов: нет 0 и O, нет 1, I и L. 31^6 ~ 887 млн
 * комбинаций - перебрать нельзя, продиктовать по телефону легко.
 */
export const INVITE_CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export const INVITE_CODE_LENGTH = 6;

/**
 * Кириллические буквы, визуально НЕОТЛИЧИМЫЕ от латинских. В Узбекистане много
 * печатают на кириллице, и без этой карты человек вводит "правильный" код, а
 * бот отвечает "такого кода нет" - самая обидная из возможных ошибок.
 */
const CYRILLIC_LOOKALIKES: Record<string, string> = {
  А: "A", В: "B", Е: "E", К: "K", М: "M", Н: "H",
  О: "O", Р: "P", С: "C", Т: "T", У: "Y", Х: "X",
};

/** Привести пользовательский ввод к каноническому виду кода. */
export function normalizeInviteCode(raw: string): string {
  const upper = (raw ?? "").toUpperCase();
  let out = "";
  for (const ch of upper) {
    const mapped = CYRILLIC_LOOKALIKES[ch] ?? ch;
    if (INVITE_CODE_ALPHABET.includes(mapped)) out += mapped;
  }
  return out;
}

/** Сгенерировать новый код. Уникальность гарантирует индекс в БД, не эта функция. */
export function generateInviteCode(): string {
  const bytes = new Uint8Array(INVITE_CODE_LENGTH);
  crypto.getRandomValues(bytes);
  let out = "";
  for (const b of bytes) out += INVITE_CODE_ALPHABET[b % INVITE_CODE_ALPHABET.length];
  return out;
}
```

- [ ] **Step 4: Запустить тест, убедиться что проходит**

Run: `pnpm vitest run src/lib/invite/code.test.ts`
Expected: PASS

Если тест `normalizeInviteCode("привет")` упадёт - пересчитать ожидаемую строку руками по карте выше и поправить **тест**, а не реализацию: важна логика, а не конкретная строка.

- [ ] **Step 5: Коммит**

```bash
git add src/lib/invite/code.ts src/lib/invite/code.test.ts
git commit -m "feat(invite): нормализация кода с картой кириллицы и генератор"
```

---

### Task 3: Фича-флаг invite_gate

**Files:**
- Modify: `src/lib/features/features.ts`
- Test: `src/lib/features/flags.test.ts`

**Interfaces:**
- Consumes: ничего.
- Produces: `Feature` пополняется значением `"invite_gate"`; `FEATURE_DEFAULTS.invite_gate === false`; ключ в БД - `feature_invite_gate_enabled`.

- [ ] **Step 1: Написать падающий тест**

Дописать в `src/lib/features/flags.test.ts`:

```ts
import { FEATURES, FEATURE_DEFAULTS, featureKey } from "./features";

describe("invite_gate", () => {
  it("есть в списке фич", () => {
    expect(FEATURES).toContain("invite_gate");
  });

  // Шлагбаум ВЫКЛЮЧЕН по умолчанию: выкладка кода не должна ничего менять
  // для живых пользователей. Включается осознанно, отдельным действием.
  it("по умолчанию выключен", () => {
    expect(FEATURE_DEFAULTS.invite_gate).toBe(false);
  });

  it("ключ в app_settings совпадает с соглашением", () => {
    expect(featureKey("invite_gate")).toBe("feature_invite_gate_enabled");
  });
});
```

- [ ] **Step 2: Запустить тест, убедиться что падает**

Run: `pnpm vitest run src/lib/features/flags.test.ts`
Expected: FAIL - `invite_gate` отсутствует в FEATURES

- [ ] **Step 3: Реализация**

В `src/lib/features/features.ts` дополнить две константы:

```ts
export const FEATURES = ["verification", "matching", "interests", "chat", "payments", "invite_gate"] as const;
```

```ts
export const FEATURE_DEFAULTS: Record<Feature, boolean> = {
  verification: true,
  matching: true,
  interests: true,
  chat: true,
  payments: false,
  // Внимание: у остальных флагов true = "фича работает" (kill switch).
  // Здесь true = "шлагбаум ОПУЩЕН, код обязателен". Дефолт false - вход открыт,
  // как сейчас; включаем вручную, когда очередь модерации разобрана.
  invite_gate: false,
};
```

- [ ] **Step 4: Запустить тесты**

Run: `pnpm vitest run src/lib/features/`
Expected: PASS (включая существующие тесты)

- [ ] **Step 5: Коммит**

```bash
git add src/lib/features/features.ts src/lib/features/flags.test.ts
git commit -m "feat(invite): фича-флаг invite_gate, по умолчанию выключен"
```

---

### Task 4: Стейт-машина - новый шаг

**Files:**
- Modify: `src/lib/state-machine/types.ts` (объект `ALLOWED_TRANSITIONS`, ~строка 88)
- Test: `src/lib/state-machine/invite-step.test.ts`

**Interfaces:**
- Consumes: тип `OnboardingStep` из `./types`.
- Produces: `ALLOWED_TRANSITIONS.bot_language === ["bot_invite_code", "bot_consent_pd"]`, `ALLOWED_TRANSITIONS.bot_invite_code === ["bot_consent_pd"]`.

- [ ] **Step 1: Написать падающий тест**

Создать `src/lib/state-machine/invite-step.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { ALLOWED_TRANSITIONS, ALL_STEPS } from "./types";

describe("шаг кода приглашения", () => {
  it("bot_invite_code существует как шаг", () => {
    expect(ALL_STEPS).toContain("bot_invite_code");
  });

  // Шлагбаум ОПУЩЕН: язык -> код.
  it("из языка можно пойти на шаг кода", () => {
    expect(ALLOWED_TRANSITIONS.bot_language).toContain("bot_invite_code");
  });

  // Шлагбаум ПОДНЯТ: язык -> сразу оферта. Обе стрелки разрешены всегда,
  // выбор делает бот по флагу - поэтому переключение не требует деплоя.
  it("из языка по-прежнему можно пойти сразу на оферту", () => {
    expect(ALLOWED_TRANSITIONS.bot_language).toContain("bot_consent_pd");
  });

  it("после кода идёт оферта и только она", () => {
    expect(ALLOWED_TRANSITIONS.bot_invite_code).toEqual(["bot_consent_pd"]);
  });

  it("шаг кода не ведёт назад в язык - иначе можно зациклиться", () => {
    expect(ALLOWED_TRANSITIONS.bot_invite_code).not.toContain("bot_language");
  });
});
```

- [ ] **Step 2: Запустить тест, убедиться что падает**

Run: `pnpm vitest run src/lib/state-machine/invite-step.test.ts`
Expected: FAIL - `bot_invite_code` отсутствует

- [ ] **Step 3: Реализация**

В `src/lib/state-machine/types.ts` найти строку `bot_language: ["bot_consent_pd"],` и заменить на:

```ts
  // Коды-приглашения (2026-08-11): обе стрелки разрешены ВСЕГДА. Какую выбрать,
  // решает бот по флагу invite_gate - поэтому шлагбаум переключается без деплоя.
  bot_language: ["bot_invite_code", "bot_consent_pd"],
  bot_invite_code: ["bot_consent_pd"],
```

Тип `OnboardingStep` выводится из ключей `ALLOWED_TRANSITIONS`, отдельно править не нужно. Если в файле есть явное объединение строк с перечнем шагов - добавить `"bot_invite_code"` и туда.

- [ ] **Step 4: Запустить все тесты стейт-машины**

Run: `pnpm vitest run src/lib/state-machine/`
Expected: PASS. Существующие тесты графа не должны сломаться: мы только добавили стрелку, ничего не убрали.

- [ ] **Step 5: Проверить типы**

Run: `pnpm tsc --noEmit`
Expected: 0 ошибок. Если `switch` по `OnboardingStep` где-то требует полноты - компилятор укажет файл; добавить ветку `case "bot_invite_code":` рядом с `bot_language`.

- [ ] **Step 6: Коммит**

```bash
git add src/lib/state-machine/types.ts src/lib/state-machine/invite-step.test.ts
git commit -m "feat(invite): шаг bot_invite_code в стейт-машине"
```

---

### Task 5: Слой работы с кодами

**Files:**
- Create: `src/lib/invite/store.ts`
- Test: `src/lib/invite/store.test.ts`

**Interfaces:**
- Consumes: `normalizeInviteCode` из `./code`, `generateInviteCode` из `./code`, `supabaseAdmin` из `@/lib/supabase/admin`.
- Produces:
  - `type InviteCodeRow = { id: string; code: string; owner_id: string | null; disabled_at: string | null }`
  - `findActiveCode(raw: string): Promise<InviteCodeRow | null>`
  - `ensureCodeForUser(userId: string): Promise<string>` - возвращает код, создаёт при отсутствии
  - `disableCodesOfUser(userId: string, reason: string): Promise<void>`
  - `reviveBanDisabledCodes(userId: string): Promise<void>`
  - `countInvitedBy(userId: string): Promise<number>`
  - `codeExistsButDisabled(raw: string): Promise<boolean>` - нужен, чтобы отличить «кода нет» от «код погашен»

- [ ] **Step 1: Написать падающий тест**

Создать `src/lib/invite/store.test.ts`. Мок базы - по образцу `src/lib/telegram/bot/commands.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

let codeRow: Record<string, unknown> | null = null;
const inserted: Array<Record<string, unknown>> = [];
const updated: Array<Record<string, unknown>> = [];

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          is: () => ({ maybeSingle: () => Promise.resolve({ data: codeRow, error: null }) }),
          eq: () => ({ maybeSingle: () => Promise.resolve({ data: codeRow, error: null }) }),
        }),
      }),
      insert: (row: Record<string, unknown>) => {
        inserted.push(row);
        return {
          select: () => ({
            single: () => Promise.resolve({ data: { ...row, id: "new-id" }, error: null }),
          }),
        };
      },
      update: (row: Record<string, unknown>) => {
        updated.push(row);
        return { eq: () => ({ is: () => Promise.resolve({ error: null }) }) };
      },
    }),
  }),
}));

import { findActiveCode } from "./store";

beforeEach(() => {
  codeRow = null;
  inserted.length = 0;
  updated.length = 0;
});

describe("findActiveCode", () => {
  it("ищет по НОРМАЛИЗОВАННОМУ коду - кириллица находит латинский код", async () => {
    codeRow = { id: "c1", code: "BAXT7K", owner_id: "u1", disabled_at: null };
    const found = await findActiveCode("вахт7к");
    expect(found?.code).toBe("BAXT7K");
  });

  it("возвращает null, если кода нет", async () => {
    codeRow = null;
    expect(await findActiveCode("ZZZZZZ")).toBeNull();
  });

  it("возвращает null на пустом вводе, не ходя в базу", async () => {
    expect(await findActiveCode("!!!")).toBeNull();
  });
});
```

- [ ] **Step 2: Запустить тест, убедиться что падает**

Run: `pnpm vitest run src/lib/invite/store.test.ts`
Expected: FAIL - `Cannot find module './store'`

- [ ] **Step 3: Написать реализацию**

Создать `src/lib/invite/store.ts`:

```ts
import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { normalizeInviteCode, generateInviteCode } from "./code";

export type InviteCodeRow = {
  id: string;
  code: string;
  owner_id: string | null;
  disabled_at: string | null;
};

/**
 * Найти ДЕЙСТВУЮЩИЙ код по пользовательскому вводу.
 * Нормализация обязательна: см. карту кириллицы в ./code.
 */
export async function findActiveCode(raw: string): Promise<InviteCodeRow | null> {
  const code = normalizeInviteCode(raw);
  if (!code) return null; // мусор - в базу не ходим
  const { data, error } = await supabaseAdmin()
    .from("invite_codes")
    .select("id, code, owner_id, disabled_at")
    .eq("code", code)
    .is("disabled_at", null)
    .maybeSingle();
  if (error) return null; // сбой БД = кода нет; вход закрыт, а не открыт настежь
  return (data as InviteCodeRow) ?? null;
}

/**
 * Существует ли такой код, но погашен. Нужен, чтобы показать человеку правильный
 * текст: "попросите новый" вместо "проверьте раскладку".
 */
export async function codeExistsButDisabled(raw: string): Promise<boolean> {
  const code = normalizeInviteCode(raw);
  if (!code) return false;
  const { data } = await supabaseAdmin()
    .from("invite_codes")
    .select("id")
    .eq("code", code)
    .maybeSingle();
  return !!data;
}

/** Код пользователя; создаёт при отсутствии. Подстраховка на случай, если при одобрении верификации код не создался. */
export async function ensureCodeForUser(userId: string): Promise<string> {
  const sb = supabaseAdmin();
  const { data } = await sb
    .from("invite_codes")
    .select("code")
    .eq("owner_id", userId)
    .is("disabled_at", null)
    .maybeSingle();
  if (data) return (data as { code: string }).code;

  // Коллизия кода почти невероятна (31^6), но индекс её поймает - пробуем трижды.
  for (let attempt = 0; attempt < 3; attempt++) {
    const code = generateInviteCode();
    const { error } = await sb.from("invite_codes").insert({ code, owner_id: userId });
    if (!error) return code;
  }
  throw new Error("не удалось выпустить код приглашения");
}

/** Погасить все активные коды пользователя (бан, утечка, ручное действие). */
export async function disableCodesOfUser(userId: string, reason: string): Promise<void> {
  await supabaseAdmin()
    .from("invite_codes")
    .update({ disabled_at: new Date().toISOString(), disabled_reason: reason })
    .eq("owner_id", userId)
    .is("disabled_at", null);
}

/** Оживить коды, погашенные ИМЕННО из-за бана (разбан). Погашенные за утечку не трогаем. */
export async function reviveBanDisabledCodes(userId: string): Promise<void> {
  await supabaseAdmin()
    .from("invite_codes")
    .update({ disabled_at: null, disabled_reason: null })
    .eq("owner_id", userId)
    .eq("disabled_reason", "ban");
}

/** Сколько человек пришло по кодам этого пользователя. Считаем на месте - денормализация разъезжается с правдой. */
export async function countInvitedBy(userId: string): Promise<number> {
  const { count } = await supabaseAdmin()
    .from("users")
    .select("id", { count: "exact", head: true })
    .eq("invited_by", userId)
    .is("deleted_at", null);
  return count ?? 0;
}
```

- [ ] **Step 4: Запустить тест**

Run: `pnpm vitest run src/lib/invite/store.test.ts`
Expected: PASS. Если мок не совпал по цепочке вызовов - подогнать мок под реальную цепочку из реализации, а не наоборот.

- [ ] **Step 5: Коммит**

```bash
git add src/lib/invite/store.ts src/lib/invite/store.test.ts
git commit -m "feat(invite): слой работы с кодами - поиск, выпуск, гашение, счётчик"
```

---

### Task 6: Решение о шаге и зачёт кода

Отдельный модуль, чтобы логику «показывать ли шаг» можно было проверить в отрыве от бота.

**Files:**
- Create: `src/lib/invite/gate.ts`
- Test: `src/lib/invite/gate.test.ts`

**Interfaces:**
- Consumes: `isFeatureEnabled` из `@/lib/features/flags`, `findActiveCode` из `./store`.
- Produces:
  - `needsInviteStep(user: { invite_redeemed_at: string | null; invite_exempt: boolean }): Promise<boolean>`
  - `redeemCode(userId: string, raw: string): Promise<{ ok: true } | { ok: false; reason: "not_found" | "disabled" | "self" }>`

**Почему три причины, а не две:** спека требует РАЗНЫХ текстов для «кода нет» и «код погашен». Если не различать, человек с погасшим кодом получит совет «проверьте раскладку» и будет проверять её бесконечно, вместо того чтобы попросить новый код.

- [ ] **Step 1: Написать падающий тест**

Создать `src/lib/invite/gate.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

let gateOn = true;
vi.mock("@/lib/features/flags", () => ({
  isFeatureEnabled: () => Promise.resolve(gateOn),
}));
vi.mock("./store", () => ({ findActiveCode: () => Promise.resolve(null) }));
vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({ from: () => ({ update: () => ({ eq: () => Promise.resolve({ error: null }) }) }) }),
}));

import { needsInviteStep } from "./gate";

beforeEach(() => { gateOn = true; });

describe("needsInviteStep", () => {
  it("шлагбаум выключен - шаг не нужен", async () => {
    gateOn = false;
    expect(await needsInviteStep({ invite_redeemed_at: null, invite_exempt: false })).toBe(false);
  });

  it("новичок при включённом шлагбауме - шаг нужен", async () => {
    expect(await needsInviteStep({ invite_redeemed_at: null, invite_exempt: false })).toBe(true);
  });

  // Ключевое правило спеки: состояние определяют ДАННЫЕ, а не история событий.
  it("код уже зачтён - шаг не нужен даже после перезапуска онбординга", async () => {
    expect(await needsInviteStep({ invite_redeemed_at: "2026-08-11T10:00:00Z", invite_exempt: false })).toBe(false);
  });

  it("вошёл до запуска - шаг не нужен", async () => {
    expect(await needsInviteStep({ invite_redeemed_at: null, invite_exempt: true })).toBe(false);
  });
});
```

- [ ] **Step 2: Запустить тест, убедиться что падает**

Run: `pnpm vitest run src/lib/invite/gate.test.ts`
Expected: FAIL - `Cannot find module './gate'`

- [ ] **Step 3: Написать реализацию**

Создать `src/lib/invite/gate.ts`:

```ts
import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { isFeatureEnabled } from "@/lib/features/flags";
import { findActiveCode } from "./store";

/**
 * Нужен ли человеку шаг ввода кода.
 *
 * Правило спеки: состояние определяется ДАННЫМИ, а не последовательностью
 * событий. Поэтому перезапуск онбординга админом, повторный вход и любое
 * переключение рубильника ничего не ломают.
 */
export async function needsInviteStep(user: {
  invite_redeemed_at: string | null;
  invite_exempt: boolean;
}): Promise<boolean> {
  if (user.invite_exempt) return false;
  if (user.invite_redeemed_at) return false;
  return await isFeatureEnabled("invite_gate");
}

/**
 * Зачесть код пользователю. Перепроверяет код В МОМЕНТ ЗАЧЁТА: между переходом
 * по ссылке и этим шагом код мог погаснуть (например, владельца забанили).
 */
export async function redeemCode(
  userId: string,
  raw: string,
): Promise<{ ok: true } | { ok: false; reason: "not_found" | "disabled" | "self" }> {
  const row = await findActiveCode(raw);
  if (!row) {
    // Различаем "кода нет" и "код погашен": иначе человеку с погасшим кодом
    // советуют проверить раскладку, и он проверяет её вместо того, чтобы
    // попросить у пригласившего новый код.
    return { ok: false, reason: (await codeExistsButDisabled(raw)) ? "disabled" : "not_found" };
  }
  if (row.owner_id === userId) return { ok: false, reason: "self" };

  // invited_by пишется ОДИН РАЗ и навсегда: иначе историю "кто кого привёл"
  // можно переписать, перейдя по чужой ссылке позже.
  const { error } = await supabaseAdmin()
    .from("users")
    .update({
      invited_by: row.owner_id,
      invite_code_id: row.id,
      invite_redeemed_at: new Date().toISOString(),
    })
    .eq("id", userId)
    .is("invite_redeemed_at", null);
  if (error) return { ok: false, reason: "not_found" };
  return { ok: true };
}
```

- [ ] **Step 4: Запустить тест**

Run: `pnpm vitest run src/lib/invite/gate.test.ts`
Expected: PASS

- [ ] **Step 5: Коммит**

```bash
git add src/lib/invite/gate.ts src/lib/invite/gate.test.ts
git commit -m "feat(invite): решение о шаге и зачёт кода с перепроверкой"
```

---

### Task 7: Бот - тексты, экран кода, приём кода из ссылки

**Files:**
- Modify: `src/lib/telegram/bot/messages.ts` (объект `M`)
- Modify: `src/lib/telegram/bot/handlers.ts` (три места: `promptStep` ~строка 355, ветка `ns === "lang"` ~строка 565, `handleUpdate` ~строка 783 и текстовый фолбэк ~строка 809)
- Test: `src/lib/telegram/bot/invite-flow.test.ts`

**Interfaces:**
- Consumes: `needsInviteStep`, `redeemCode` из `@/lib/invite/gate`; `tryTransition` из `@/lib/state-machine/transitions`.
- Produces: ключи `M.invite_ask`, `M.invite_accepted`, `M.invite_not_found`, `M.invite_disabled`, `M.invite_no_code_button`, `M.invite_no_code_text`.

- [ ] **Step 1: Добавить тексты на четыре языка**

В `src/lib/telegram/bot/messages.ts` внутрь объекта `M` добавить:

```ts
  invite_ask: {
    ru:
      "Baxtlilar сейчас работает по приглашениям.\n\n" +
      "Наш клуб пока закрытый: войти можно только по коду от человека, который уже здесь.\n" +
      "Отправьте код сообщением - или откройте ссылку-приглашение, которую Вам прислали.",
    uz:
      "Baxtlilar hozircha taklif asosida ishlaydi.\n\n" +
      "Klubimiz yopiq: faqat shu yerda boʻlgan insonning kodi bilan kirish mumkin.\n" +
      "Kodni xabar qilib yuboring - yoki sizga yuborilgan taklif havolasini oching.",
    tr:
      "Baxtlilar şu anda davetle çalışıyor.\n\n" +
      "Kulübümüz kapalı: yalnızca burada olan birinin koduyla girebilirsiniz.\n" +
      "Kodu mesaj olarak gönderin - ya da size gönderilen davet bağlantısını açın.",
    en:
      "Baxtlilar is currently invite-only.\n\n" +
      "Our club is closed for now: you can join only with a code from someone already here.\n" +
      "Send the code as a message - or open the invitation link you were given.",
  },
  invite_accepted: {
    ru: "Приглашение принято. Добро пожаловать в Baxtlilar.",
    uz: "Taklif qabul qilindi. Baxtlilarga xush kelibsiz.",
    tr: "Davet kabul edildi. Baxtlilar'a hoş geldiniz.",
    en: "Invitation accepted. Welcome to Baxtlilar.",
  },
  invite_not_found: {
    ru: "Такого кода нет. Проверьте раскладку и попробуйте снова - в коде только буквы и цифры.",
    uz: "Bunday kod yoʻq. Klaviatura tilini tekshirib, qayta urinib koʻring - kodda faqat harf va raqamlar boʻladi.",
    tr: "Böyle bir kod yok. Klavye düzenini kontrol edip tekrar deneyin - kodda yalnızca harf ve rakam var.",
    en: "No such code. Check your keyboard layout and try again - the code has only letters and digits.",
  },
  invite_disabled: {
    ru: "Этот код больше не действует. Попросите у пригласившего новый.",
    uz: "Bu kod endi ishlamaydi. Taklif qilgan insondan yangisini soʻrang.",
    tr: "Bu kod artık geçerli değil. Sizi davet edenden yenisini isteyin.",
    en: "This code no longer works. Ask the person who invited you for a new one.",
  },
  invite_no_code_button: {
    ru: "Нет кода?", uz: "Kod yoʻqmi?", tr: "Kodunuz yok mu?", en: "No code?",
  },
  invite_no_code_text: {
    ru:
      "Мы растём только через личные рекомендации - так безопаснее для всех, кто уже здесь.\n\n" +
      "Если Вам некого попросить, напишите нам, и мы подскажем.",
    uz:
      "Biz faqat shaxsiy tavsiyalar orqali oʻsamiz - bu shu yerdagilar uchun xavfsizroq.\n\n" +
      "Soʻraydigan odamingiz boʻlmasa, bizga yozing, yoʻl koʻrsatamiz.",
    tr:
      "Yalnızca kişisel tavsiyelerle büyüyoruz - bu, burada olan herkes için daha güvenli.\n\n" +
      "İsteyeceğiniz kimse yoksa bize yazın, yardımcı olalım.",
    en:
      "We grow only through personal recommendations - it is safer for everyone already here.\n\n" +
      "If you have no one to ask, write to us and we will help.",
  },
```

- [ ] **Step 2: Написать падающий тест потока**

Создать `src/lib/telegram/bot/invite-flow.test.ts`, взяв блок моков целиком из `commands.test.ts` (строки 1-45) и добавив:

```ts
vi.mock("@/lib/invite/gate", () => ({
  needsInviteStep: () => Promise.resolve(gateOn),
  redeemCode: (_u: string, raw: string) =>
    Promise.resolve(raw.toUpperCase().includes("GOOD") ? { ok: true } : { ok: false, reason: "not_found" }),
}));
let gateOn = true;
```

Тесты:

```ts
describe("шаг кода в боте", () => {
  it("на шаге bot_invite_code бот просит код", async () => {
    currentUser = { id: "u1", telegram_id: 1, language: "ru", onboarding_step: "bot_invite_code", lifecycle_state: "onboarding" };
    await promptStep(1, currentUser as never);
    expect(sent.at(-1)?.text).toContain(M.invite_ask.ru.slice(0, 20));
  });

  it("верный код ведёт дальше и благодарит", async () => {
    currentUser = { id: "u1", telegram_id: 1, language: "ru", onboarding_step: "bot_invite_code", lifecycle_state: "onboarding" };
    await handleUpdate({ message: { chat: { id: 1 }, from: { id: 1 }, text: "GOOD12" } } as never);
    expect(sent.some((s) => s.text.includes(M.invite_accepted.ru))).toBe(true);
  });

  it("неверный код оставляет на шаге и объясняет", async () => {
    currentUser = { id: "u1", telegram_id: 1, language: "ru", onboarding_step: "bot_invite_code", lifecycle_state: "onboarding" };
    await handleUpdate({ message: { chat: { id: 1 }, from: { id: 1 }, text: "BAD999" } } as never);
    expect(sent.some((s) => s.text.includes(M.invite_not_found.ru))).toBe(true);
  });
});
```

- [ ] **Step 3: Запустить тест, убедиться что падает**

Run: `pnpm vitest run src/lib/telegram/bot/invite-flow.test.ts`
Expected: FAIL - бот пока не знает про шаг кода

- [ ] **Step 4: Реализация - экран шага**

В `handlers.ts`, в `switch (user.onboarding_step)` внутри `promptStep`, добавить ветку рядом с `case "bot_language"`:

```ts
    case "bot_invite_code":
      await sendMessage(chatId, pick(M.invite_ask, user.language), {
        inline_keyboard: [[{ text: pick(M.invite_no_code_button, user.language), callback_data: "inv:help" }]],
      });
      return;
```

- [ ] **Step 5: Реализация - выбор следующего шага после языка**

**Сначала проверить `findByTg`** (`src/lib/telegram/bot/handlers.ts`): если он выбирает колонки перечислением, а не `select("*")`, добавить в список `invite_redeemed_at` и `invite_exempt`. Иначе они придут `undefined`, `needsInviteStep` вернёт `true` для всех - и шаг кода увидят даже те, кто вошёл до запуска. Тихая ошибка: тесты с моком её не поймают.

В ветке `ns === "lang"` заменить жёсткий переход на `bot_consent_pd`:

```ts
      // Коды-приглашения: следующий шаг зависит от шлагбаума и от того, не
      // пришёл ли человек уже по ссылке (тогда код зачтён и шаг не нужен).
      const needCode = await needsInviteStep({
        invite_redeemed_at: (user as { invite_redeemed_at: string | null }).invite_redeemed_at,
        invite_exempt: (user as { invite_exempt: boolean }).invite_exempt,
      });
      const nextStep = needCode ? "bot_invite_code" : "bot_consent_pd";
      const r = await tryTransition(
        user.id,
        { onboarding_step: nextStep, language: lang },
        "bot:language_picked",
        { kind: "user", id: user.id },
      );
      if (!r.ok) {
        await answerCallbackQuery(cb.id, "Try /start again");
        return;
      }
      await syncMenuButton(chatId, lang);
      await answerCallbackQuery(cb.id);
      if (needCode) {
        await sendMessage(chatId, pick(M.invite_ask, lang), {
          inline_keyboard: [[{ text: pick(M.invite_no_code_button, lang), callback_data: "inv:help" }]],
        });
      } else {
        await sendLegalDocsAndConsentPrompt(chatId, lang);
      }
      return;
```

- [ ] **Step 6: Реализация - код из ссылки**

В `handleStart` (после того как пользователь найден или создан) добавить разбор аргумента:

```ts
  // t.me/baxtlilar_uz_bot?start=КОД - Telegram присылает "/start КОД".
  // Аргумент /start до этой задачи ничем не был занят (проверено).
  const payload = (msg.text ?? "").split(/\s+/)[1];
  if (payload && !user.invite_redeemed_at) {
    await redeemCode(user.id, payload);
    // Молча: если код плохой, человек просто увидит обычный экран ввода.
  }
```

- [ ] **Step 7: Реализация - ввод кода текстом**

В `handleUpdate`, в блоке обычных сообщений, ПЕРЕД фолбэком `promptStep`:

```ts
    const user = update.message.from ? await findByTg(update.message.from.id) : null;
    if (user && user.onboarding_step === "bot_invite_code" && update.message.text) {
      const res = await redeemCode(user.id, update.message.text);
      if (res.ok) {
        await tryTransition(
          user.id,
          { onboarding_step: "bot_consent_pd" },
          "bot:invite_redeemed",
          { kind: "user", id: user.id },
        );
        await sendMessage(update.message.chat.id, pick(M.invite_accepted, user.language));
        await sendLegalDocsAndConsentPrompt(update.message.chat.id, user.language);
      } else {
        // Разные тексты для "кода нет" и "код погашен" - см. Task 6.
        const msg = res.reason === "disabled" ? M.invite_disabled : M.invite_not_found;
        await sendMessage(update.message.chat.id, pick(msg, user.language));
      }
      return;
    }
    if (user) await promptStep(update.message.chat.id, user);
    return;
```

Обработку `inv:help` добавить в `handleCallback` рядом с другими `ns ===` ветками:

```ts
    if (ns === "inv" && val === "help") {
      await answerCallbackQuery(cb.id);
      await sendMessage(chatId, pick(M.invite_no_code_text, user.language));
      return;
    }
```

- [ ] **Step 8: Запустить тесты и типы**

Run: `pnpm vitest run src/lib/telegram/ && pnpm tsc --noEmit`
Expected: PASS, 0 ошибок типов

- [ ] **Step 9: Коммит**

```bash
git add src/lib/telegram/bot/messages.ts src/lib/telegram/bot/handlers.ts src/lib/telegram/bot/invite-flow.test.ts
git commit -m "feat(invite): экран кода в боте, приём кода из ссылки и текстом"
```

---

### Task 8: Выдача кода при одобрении верификации + экран «Пригласить»

**Files:**
- Create: `src/app/api/invite/route.ts`
- Modify: `src/app/api/admin/cases/[id]/decision/route.ts` (после успешного одобрения)
- Modify: `src/app/api/admin/users/[id]/ban/route.ts` и `unban/route.ts`
- Test: `src/lib/invite/store.test.ts` (дополнить)

**Interfaces:**
- Consumes: `ensureCodeForUser`, `countInvitedBy`, `disableCodesOfUser`, `reviveBanDisabledCodes` из `@/lib/invite/store`.
- Produces: `GET /api/invite` -> `{ ok: true, code: string, invited: number }` либо `{ ok: false, error: "not_verified" }` со статусом 403.

- [ ] **Step 1: Написать роут**

Создать `src/app/api/invite/route.ts`:

```ts
import { NextResponse } from "next/server";
import { requireUserForRequest } from "@/lib/auth/session";
import { ensureCodeForUser, countInvitedBy } from "@/lib/invite/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Код приглашения и счётчик. Приглашать могут ТОЛЬКО пользователи с одобренной
 * верификацией - это главный тормоз против лавины вместо лимита на код.
 *
 * Отдаём только ЧИСЛО приглашённых: имена раскрыли бы третьему лицу факт поиска
 * брака без согласия самого человека.
 */
export async function GET(): Promise<NextResponse> {
  const gate = await requireUserForRequest();
  if ("res" in gate) return gate.res;
  const { user } = gate;

  if (user.verification_status !== "approved") {
    return NextResponse.json({ ok: false, error: "not_verified" }, { status: 403 });
  }

  const [code, invited] = await Promise.all([
    ensureCodeForUser(user.id),
    countInvitedBy(user.id),
  ]);
  return NextResponse.json({ ok: true, code, invited });
}
```

Точное имя функции авторизации взять из соседнего роута `src/app/api/account/route.ts` - в нём тот же шаблон получения текущего пользователя.

- [ ] **Step 2: Выпуск кода при одобрении**

В `src/app/api/admin/cases/[id]/decision/route.ts` после успешного одобрения (ветка, где исход `approved`) добавить:

```ts
  // Приглашать могут только подтверждённые люди - код выпускаем здесь же.
  // Сбой выпуска НЕ должен отменять одобрение: подстраховка есть в GET /api/invite.
  try {
    await ensureCodeForUser(targetUserId);
  } catch (e) {
    console.error("[decision] выпуск кода приглашения не удался:", e);
  }
```

- [ ] **Step 3: Гашение при бане и оживление при разбане**

В `ban/route.ts` после успешного бана:

```ts
  await disableCodesOfUser(id, "ban");
```

В `unban/route.ts` после успешного разбана:

```ts
  // Оживляем только погашенные ИЗ-ЗА БАНА. Погашенные за утечку остаются мёртвыми.
  await reviveBanDisabledCodes(id);
```

- [ ] **Step 4: Проверить типы и тесты**

Run: `pnpm tsc --noEmit && pnpm vitest run`
Expected: 0 ошибок, все тесты проходят

- [ ] **Step 5: Коммит**

```bash
git add src/app/api/invite/route.ts src/app/api/admin/cases/\[id\]/decision/route.ts src/app/api/admin/users/\[id\]/ban/route.ts src/app/api/admin/users/\[id\]/unban/route.ts
git commit -m "feat(invite): выпуск кода при одобрении, гашение при бане, роут /api/invite"
```

---

### Task 9: Экран «Пригласить» в мини-аппе

**Files:**
- Create: `src/app/[locale]/v2/invite/page.tsx`
- Modify: файл настроек профиля - пункт меню (найти по `grep -rn "settings" src/app/\[locale\]/v2 --include=page.tsx`)
- Modify: файлы локалей `messages/ru.json`, `messages/uz.json`, `messages/en.json`

**Interfaces:**
- Consumes: `GET /api/invite`.
- Produces: страница `/v2/invite`.

- [ ] **Step 1: Страница**

Создать `src/app/[locale]/v2/invite/page.tsx` по образцу соседней страницы из `src/app/[locale]/v2/`. Содержимое: заголовок, код крупно, кнопка «Скопировать ссылку», кнопка «Поделиться в Telegram» (`https://t.me/share/url?url=...&text=...`), строка «По Вашему коду присоединились: N».

Ссылка для шаринга: `https://t.me/baxtlilar_uz_bot?start=КОД`.

При ответе 403 (`not_verified`) показать: «Приглашать смогут те, кто прошёл проверку документов. Как только Вашу анкету подтвердят, здесь появится код».

- [ ] **Step 2: Ключи локалей**

Добавить в `messages/ru.json`, `messages/uz.json`, `messages/en.json` секцию `Invite` с ключами: `title`, `subtitle`, `copy_link`, `share`, `joined_count`, `not_verified`.

Ключи опций анкеты в tr/en падают в RU - это известный принятый компромисс, но **новые экраны так делать не должны**: заполнить все три локали.

- [ ] **Step 3: Проверить сборку**

Run: `pnpm tsc --noEmit && pnpm build`
Expected: сборка проходит

- [ ] **Step 4: Коммит**

```bash
git add src/app/\[locale\]/v2/invite/ messages/
git commit -m "feat(invite): экран Пригласить в мини-аппе"
```

---

### Task 10: Админка - карточка клиента и раздел «Приглашения»

**Files:**
- Modify: `src/app/admin/clients/[id]/ProfileTab.tsx` (блок с общими сведениями)
- Create: `src/app/admin/invites/page.tsx`
- Create: `src/app/api/admin/invites/route.ts` (GET список) и `src/app/api/admin/invites/[id]/disable/route.ts` (POST гашение)

**Interfaces:**
- Consumes: `disableCodesOfUser` из `@/lib/invite/store`.
- Produces: `GET /api/admin/invites` -> `{ ok: true, rows: Array<{ id, code, owner_login: string | null, invited: number, disabled_at: string | null }> }`.

- [ ] **Step 1: Карточка клиента**

В `ProfileTab.tsx` добавить строки «Пришёл по коду» (код + имя пригласившего) и «Привёл» (число). Полная картина видна ТОЛЬКО здесь - в мини-аппе только число.

- [ ] **Step 2: Роуты админки**

Оба роута защитить существующим гейтом прав по образцу `src/app/api/admin/staff/route.ts`. Гашение писать в `admin_audit_log` - как остальные действия модератора.

- [ ] **Step 3: Страница списка**

Таблица: код, чей, сколько привёл, статус, кнопка «Погасить». Плюс форма создания мастер-кода (owner_id пустой, обязательная подпись в `label`).

- [ ] **Step 4: Проверить типы и сборку**

Run: `pnpm tsc --noEmit && pnpm build`

- [ ] **Step 5: Коммит**

```bash
git add src/app/admin/invites/ src/app/api/admin/invites/ src/app/admin/clients/\[id\]/ProfileTab.tsx
git commit -m "feat(invite): раздел Приглашения в админке и данные в карточке клиента"
```

---

### Task 11: Витрина аналитики

**Files:**
- Create: `supabase/migrations/20260811130000_invite_analytics.sql`

- [ ] **Step 1: Витрина**

```sql
-- Кто сколько привёл. Только агрегаты: имён и анкет здесь нет.
create or replace view analytics.v_invites as
select
  c.code                                            as "код",
  case when c.owner_id is null then 'мастер-код' else 'пользователь' end as "тип",
  coalesce(c.label, '')                             as "подпись",
  (select count(*) from users u
    where u.invite_code_id = c.id and u.deleted_at is null) as "привёл",
  (c.disabled_at is not null)                       as "погашен"
from invite_codes c
order by 4 desc;

-- Сводка по источникам входа.
create or replace view analytics.v_invite_summary as
select
  count(*) filter (where invite_exempt)                              as "вошли до запуска",
  count(*) filter (where invite_redeemed_at is not null)             as "вошли по коду",
  count(*) filter (where invited_by is not null)                     as "из них по личному коду",
  count(*) filter (where invite_redeemed_at is not null and invited_by is null) as "по мастер-коду"
from users where deleted_at is null;

grant select on all tables in schema analytics to grafana_ro;
```

- [ ] **Step 2: Накатить и проверить**

```bash
sudo baxtlilar-migrate apply
sudo -u postgres psql -d baxtlilar -c "select * from analytics.v_invite_summary"
```

- [ ] **Step 3: Коммит**

```bash
git add supabase/migrations/20260811130000_invite_analytics.sql
git commit -m "feat(invite): витрины аналитики по приглашениям"
```

---

### Task 12: Живая проверка и включение

- [ ] **Step 1: Выложить с выключенным флагом**

```bash
ssh baxtlilar-vps
sudo baxtlilar-deploy
```

Убедиться, что для живых людей ничего не изменилось: `/api/health` отвечает, бот отвечает на `/start`.

- [ ] **Step 2: Включить флаг только для проверки**

Включить `invite_gate` в админке, разделе управления функциями.

- [ ] **Step 3: Пройти оба пути живьём**

1. Новый Telegram-аккаунт → `/start` → язык → **должен появиться экран кода**.
2. Ввести мусор → сообщение «такого кода нет», остаёмся на шаге.
3. Ввести код кириллицей (`ВАХТ7К2М` вместо `BAXT7K2M`) → **должен пройти**.
4. Другой аккаунт → перейти по `t.me/baxtlilar_uz_bot?start=КОД` → **экран кода не показывается**, сразу оферта.
5. Проверить в базе: `select invited_by, invite_code_id, invite_redeemed_at from users where telegram_id = <id>`.

- [ ] **Step 4: Проверить, что старые пользователи не задеты**

Существующий активный пользователь пишет боту `/start` - шаг кода не появляется (он `invite_exempt`).

- [ ] **Step 5: Выключить флаг до готовности**

Выключить `invite_gate` обратно, пока очередь модерации не разобрана и у людей нет кодов.

- [ ] **Step 6: Записать факт в LIVE-документ проекта**

Внести в статус проекта на сервере: механизм готов, флаг выключен, что осталось до включения.

---

## Порядок и зависимости

```
Task 1 (миграция)  ─┬─> Task 4 (стейт-машина) ─┐
                    ├─> Task 3 (флаг) ─────────┤
Task 2 (код)  ──────┴─> Task 5 (store) ─> Task 6 (gate) ─> Task 7 (бот) ─> Task 12
                                              └─> Task 8 (роут+хуки) ─> Task 9 (экран)
                                                                     └─> Task 10 (админка)
Task 11 (аналитика) - в любой момент после Task 1
```

**Task 1 обязательно первой и накатывается на прод до выкладки кода.**

## Известные пробелы (осознанные, из спеки)

- Код гаснет при бане, но **не при отзыве верификации**. Закрывается вручную в админке.
- Ограничение на подбор кода (10 попыток в час) в этом плане не реализовано отдельной задачей: пространство 31^6 делает перебор бессмысленным, а от спама защищает существующий кулдаун на `/start`. Если в живом тесте увидим флуд - добавим отдельной задачей.

## Зависимость вне кода

Перед включением флага **разобрать очередь модерации**: сейчас одобрен 1 человек, 9 дел ждут решения. Иначе приглашать сможет один пользователь. Это работа в админке, кодом не решается.
