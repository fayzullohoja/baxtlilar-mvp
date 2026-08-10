import "server-only";
import { pool } from "@/lib/db/pool";

/**
 * Оверлей DB-редактируемых текстовок поверх статичных messages/<locale>.json.
 *
 * Модель: оверрайд заменяет ОДНУ листовую строку (dotted-key путь). Наложение
 * в getRequestConfig (src/i18n/request.ts). Значения опций (labelOf) — Tier 2,
 * здесь не покрываются.
 *
 * Безопасность рендера (двухслойная защита, см. PUT-роут для write-time валидации):
 *  - applyOverride НИКОГДА не создаёт новые ключи и не перезаписывает НЕ-строки —
 *    только замена существующего строкового листа. Кривой/устаревший оверрайд
 *    (структура изменилась) просто пропускается → рендерится база, не падает.
 *  - proto-guard: сегменты __proto__/prototype/constructor игнорируются.
 *
 * Кэш: merged-словарь на локаль кэшируется по версии из i18n_overrides_meta.
 * Версия читается с коротким TTL (обычно 0 DB-запросов на рендер). Любой admin
 * write бампает версию (триггер) + локально сбрасывает кэш версии (invalidateVersionCache).
 */

export const LOCALES = ["ru", "uz", "en", "tr"] as const;
export type Locale = (typeof LOCALES)[number];

export type FlatMessages = Record<string, string>;
type Messages = Record<string, unknown>;

const UNSAFE_SEGMENTS = new Set(["__proto__", "prototype", "constructor"]);

// --- версия словаря (кэш с TTL) ------------------------------------------

const VERSION_TTL_MS = 5000;
let versionCache: { version: number; at: number } | null = null;

async function getVersion(): Promise<number> {
  const now = Date.now();
  if (versionCache && now - versionCache.at < VERSION_TTL_MS) {
    return versionCache.version;
  }
  const { rows } = await pool().query<{ version: number }>(
    "select version from i18n_overrides_meta where id = true",
  );
  const version = rows[0]?.version ?? 0;
  versionCache = { version, at: now };
  return version;
}

/** Сброс TTL-кэша версии — вызывается роутом после успешной правки, чтобы в
 * ЭТОМ же процессе (single-instance прод) изменение отразилось немедленно. */
export function invalidateVersionCache(): void {
  versionCache = null;
}

// --- статичная база -------------------------------------------------------

async function getBase(locale: Locale): Promise<Messages> {
  const mod = (await import(`../../../messages/${locale}.json`)) as {
    default: Messages;
  };
  return mod.default;
}

// --- наложение -----------------------------------------------------------

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Заменяет строковый лист по dotted-пути. Возвращает true, если применено.
 * Fail-safe: не создаёт ключи, не перезаписывает не-строки, отвергает proto-пути.
 */
export function applyOverride(root: Messages, dottedKey: string, value: string): boolean {
  const segs = dottedKey.split(".");
  if (segs.length === 0 || segs.some((s) => s === "" || UNSAFE_SEGMENTS.has(s))) {
    return false;
  }
  let node: Record<string, unknown> = root;
  for (let i = 0; i < segs.length - 1; i++) {
    const next = node[segs[i]];
    if (!isPlainObject(next)) return false; // путь не ведёт к объекту → пропуск
    node = next;
  }
  const leaf = segs[segs.length - 1];
  if (typeof node[leaf] !== "string") return false; // только замена существующей строки
  node[leaf] = value;
  return true;
}

// --- merged messages (кэш по версии) -------------------------------------

const mergedCache = new Map<Locale, { version: number; messages: Messages }>();

export async function fetchOverrides(locale: Locale): Promise<FlatMessages> {
  const { rows } = await pool().query<{ key: string; value: string }>(
    "select key, value from i18n_overrides where locale = $1",
    [locale],
  );
  const out: FlatMessages = {};
  for (const r of rows) out[r.key] = r.value;
  return out;
}

/** Словарь для next-intl: статичная база + DB-оверрайды (кэш по версии). */
export async function getMergedMessages(locale: Locale): Promise<Messages> {
  const version = await getVersion();
  const cached = mergedCache.get(locale);
  if (cached && cached.version === version) return cached.messages;

  const base = await getBase(locale);
  const overrides = await fetchOverrides(locale);
  // Клон, чтобы не мутировать разделяемый импортированный JSON-модуль.
  const merged: Messages = structuredClone(base);
  for (const [key, value] of Object.entries(overrides)) {
    applyOverride(merged, key, value);
  }
  mergedCache.set(locale, { version, messages: merged });
  return merged;
}

// --- плоское представление для редактора ---------------------------------

/** Все СТРОКОВЫЕ листья как dotted-key → строка. Массивы/объекты/числа
 * исключаются (Tier 1: редактируем только строковые тексты экранов). */
export function flattenStrings(obj: unknown, prefix = ""): FlatMessages {
  const out: FlatMessages = {};
  if (!isPlainObject(obj)) return out;
  for (const [k, v] of Object.entries(obj)) {
    if (UNSAFE_SEGMENTS.has(k)) continue;
    const path = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "string") {
      out[path] = v;
    } else if (isPlainObject(v)) {
      Object.assign(out, flattenStrings(v, path));
    }
    // массивы/числа/булевы — вне Tier 1
  }
  return out;
}

/** Плоская база локали (строковые листья). */
export async function flatBase(locale: Locale): Promise<FlatMessages> {
  return flattenStrings(await getBase(locale));
}

// --- валидация плейсхолдеров (write-time) --------------------------------

// ICU-аргументы: идентификатор сразу после `{` (ловит {name} и {count, plural,…}).
// Ветки plural/select ({текст}, one {…}) НЕ ловятся: после `{` не ASCII-идентификатор.
const ARG_RE = /\{\s*([a-zA-Z_][a-zA-Z0-9_]*)/g;
// Rich-теги next-intl: <b>…</b>, <link>…</link> и т.п.
const TAG_RE = /<\/?([a-zA-Z][a-zA-Z0-9]*)>/g;

function matchSet(str: string, re: RegExp): Set<string> {
  const set = new Set<string>();
  for (const m of str.matchAll(re)) set.add(m[1]);
  return set;
}

export function extractArgs(str: string): Set<string> {
  return matchSet(str, ARG_RE);
}
export function extractTags(str: string): Set<string> {
  return matchSet(str, TAG_RE);
}

function sameSet(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const x of a) if (!b.has(x)) return false;
  return true;
}

export type ValidationResult = { ok: true } | { ok: false; error: string };

/**
 * ICU-структурная проверка: сбалансированность `{ }` и rich-тегов `<t>…</t>`.
 * НЕ полный ICU-парсер, но ловит реальный класс поломок админа (незакрытая
 * {скобка} или <тег>): такой оверрайд проходит set-equality плейсхолдеров, но
 * ломает разбор ICU → t() отдаёт fallback-ключ вместо текста живому юзеру.
 * Учитывает ICU-кавычки: '{' / '}' — литеральные скобки, '' — литеральный '.
 */
export function validateIcuStructure(str: string): ValidationResult {
  let depth = 0;
  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    if (c === "'") {
      const next = str[i + 1];
      if (next === "'") { i++; continue; } // '' → литеральный апостроф
      if (next === "{" || next === "}" || next === "#" || next === "|") {
        // цитируемая литеральная секция до следующей одиночной ' (скобки внутри — литералы)
        const close = str.indexOf("'", i + 2);
        i = close === -1 ? str.length : close;
        continue;
      }
      continue; // одиночный ' = литеральный апостроф
    }
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth < 0) return { ok: false, error: "лишняя закрывающая } — проверьте скобки" };
    }
  }
  if (depth !== 0) return { ok: false, error: "незакрытая { — количество { и } должно совпадать" };

  const stack: string[] = [];
  const re = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(str))) {
    if (m[1] === "/") {
      if (stack.pop() !== m[2]) return { ok: false, error: `тег <${m[2]}> закрыт неверно` };
    } else {
      stack.push(m[2]);
    }
  }
  if (stack.length) return { ok: false, error: `незакрытый тег <${stack[0]}>` };
  return { ok: true };
}

/**
 * ⛔ SEC-XSS-1. Запрещает сырой HTML в значении оверрайда.
 *
 * Дыра: `TAG_RE` ловит только ГОЛЫЕ теги (`<b>`, `</b>`) — тег С АТРИБУТАМИ под
 * него не подходит. Поэтому `<img src=x onerror="...">` давал ПУСТОЕ множество
 * тегов, совпадал с пустым множеством базы и проходил и tag-проверку, и ICU.
 * А два экрана верификации рендерили строку через dangerouslySetInnerHTML (при
 * CSP с 'unsafe-inline') ⇒ stored XSS на всех пользователей. Право `i18n.edit`
 * есть и у МОДЕРАТОРА, то есть эскалация из младшей роли.
 *
 * Правило: вырезаем ТОЛЬКО голые теги из белого списка форматирования; любой
 * оставшийся `<` — недопустим. Белый список (а не «любой голый тег») важен:
 * иначе `<script>…</script>` — тоже голые теги — проехал бы эту проверку и
 * держался бы лишь на равенстве наборов тегов с базой.
 */
const ALLOWED_RICH_TAGS = ["b", "i", "em", "strong", "u", "br", "link"] as const;
const ALLOWED_TAG_RE = new RegExp(`</?(?:${ALLOWED_RICH_TAGS.join("|")})>`, "gi");

export function validateNoRawHtml(candidate: string): ValidationResult {
  const stripped = candidate.replace(ALLOWED_TAG_RE, "");
  if (stripped.includes("<")) {
    return {
      ok: false,
      error:
        "HTML не допускается. Символ «<» разрешён только как парный тег оформления вида <b>текст</b> — теги с атрибутами (например <img src=…>) запрещены.",
    };
  }
  return { ok: true };
}

/** Полная write-time валидация значения: нет сырого HTML, сохранён набор
 * плейсхолдеров/тегов (относительно базы) И структура ICU корректна. */
export function validateOverrideText(base: string, candidate: string): ValidationResult {
  const html = validateNoRawHtml(candidate);
  if (!html.ok) return html;
  const ph = validatePlaceholders(base, candidate);
  if (!ph.ok) return ph;
  return validateIcuStructure(candidate);
}

/** Оверрайд обязан сохранять тот же набор ICU-аргументов и rich-тегов, что и
 * база — иначе t()/t.rich бросит на рендере и уронит живой экран. */
export function validatePlaceholders(base: string, candidate: string): ValidationResult {
  if (!sameSet(extractArgs(base), extractArgs(candidate))) {
    const baseArgs = [...extractArgs(base)].sort().join(", ") || "—";
    const candArgs = [...extractArgs(candidate)].sort().join(", ") || "—";
    return {
      ok: false,
      error: `Набор плейсхолдеров {…} должен совпадать с оригиналом. Оригинал: ${baseArgs}; в тексте: ${candArgs}`,
    };
  }
  if (!sameSet(extractTags(base), extractTags(candidate))) {
    const baseTags = [...extractTags(base)].sort().join(", ") || "—";
    const candTags = [...extractTags(candidate)].sort().join(", ") || "—";
    return {
      ok: false,
      error: `Набор тегов <…> должен совпадать с оригиналом. Оригинал: ${baseTags}; в тексте: ${candTags}`,
    };
  }
  return { ok: true };
}
