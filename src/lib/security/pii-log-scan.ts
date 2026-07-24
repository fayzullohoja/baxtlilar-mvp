// C-012 — гейт «без PII в логах и аналитике».
//
// Сейчас утечки нет СЛУЧАЙНО (нет product_events, логи — только `[tag] err.message`).
// Но автоскана/CI нет: как только кто-то залогирует user.phone / selfie_path /
// telegram_id или заведёт event с ПД — защиты ноль. Этот сканер ищет ССЫЛКИ на
// PII-поля внутри вызовов логирования/аналитики (sink'ов) и падает, если находит.
//
// Ключевая тонкость: строковые литералы (теги логов, тексты сообщений) ВЫРЕЗАЮТСЯ
// перед проверкой — `console.error("[selfie] ...", err.message)` НЕ ложно-срабатывает
// на слове selfie в теге. Проверяются только идентификаторы и `${...}`-интерполяции.
//
// Escape-hatch: `// pii-ok: <причина>` на строке sink'а подавляет находку (для
// заведомо безопасных случаев, напр. логирование агрегата/счётчика).

export type PiiFinding = {
  file: string;
  line: number;
  tokens: string[];
  snippet: string;
};

// Sink'и: куда «утекает» текст наружу процесса. console.* + forward-looking
// (Sentry capture*, track/logEvent/emitEvent, analytics.*) — чтобы будущая
// аналитика/product_events сразу попала под гейт, а не мимо него.
const SINK_RE =
  /(?:console\s*\.\s*(?:log|info|warn|error|debug|trace)|captureMessage|captureException|Sentry\s*\.\s*[a-zA-Z]+|track|logEvent|emitEvent|analytics\s*\.\s*[a-zA-Z]+)\s*\(/g;

// PII-токены по РЕАЛЬНЫМ именам колонок/полей (см. init_schema.sql + анкета).
// Регэкспы без флага g (используем .test). Границы \b подобраны так, чтобы
// phone_verified (boolean, не ПД) НЕ матчился на \bphone\b (после phone идёт '_').
// Для полей с суффиксами (selfie_path, passport_path, religion_importance)
// граница \b ПОСЛЕ имени не сработает: за именем идёт '_' (тоже \w). Поэтому у
// таких — только начальная граница \bNAME (префикс). `phone` — исключение:
// оставляем целым словом \bphone\b, иначе поймали бы boolean phone_verified;
// значащие phone_number/phone_input идут отдельными префиксными токенами.
const PII_TOKENS: Array<{ name: string; re: RegExp }> = [
  // телефон
  { name: "phone_number", re: /\bphone_number/ },
  { name: "phoneNumber", re: /\bphoneNumber/ },
  { name: "phone_input", re: /\bphone_input/ },
  { name: "phone", re: /\bphone\b/ },
  // telegram identity
  { name: "telegram_id", re: /\btelegram_id/ },
  { name: "telegramId", re: /\btelegramId/ },
  { name: "telegram_first_name", re: /\btelegram_first_name/ },
  { name: "telegram_last_name", re: /\btelegram_last_name/ },
  // документы / биометрия
  { name: "passport", re: /\bpassport/i },
  { name: "pinfl", re: /\bpinfl/i },
  { name: "selfie", re: /\bselfie/i },
  // ФИО
  { name: "full_name", re: /\bfull_name/ },
  { name: "fullName", re: /\bfullName/ },
  { name: "first_name", re: /\bfirst_name/ },
  { name: "last_name", re: /\blast_name/ },
  { name: "middle_name", re: /\bmiddle_name/ },
  { name: "display_name", re: /\bdisplay_name/ },
  // дата рождения
  { name: "birth_date", re: /\bbirth_date/ },
  { name: "birthDate", re: /\bbirthDate/ },
  { name: "dob", re: /\bdob\b/i },
  // чувствительные атрибуты (§9 спец-категории)
  { name: "bio", re: /\bbio\b/ },
  { name: "religion", re: /\breligion/i },
  { name: "income", re: /\bincome/i },
  { name: "salary", re: /\bsalary/i },
  { name: "health", re: /\bhealth/i },
  { name: "disease", re: /\bdisease/i },
  { name: "diagnosis", re: /\bdiagnos/i },
  { name: "disability", re: /\bdisabilit/i },
  // чат / жалобы
  { name: "message_body", re: /\bmessage_body/ },
  { name: "chat_message", re: /\bchat_message/i },
  { name: "complaint", re: /\bcomplaint/i },
  { name: "report_text", re: /\breport_text/ },
];

/** Пропустить строковый литерал (', ", `) начиная с открывающей кавычки. */
function skipString(text: string, start: number): number {
  const quote = text[start];
  let i = start + 1;
  const n = text.length;
  if (quote === "`") {
    // template literal: возможны вложенные ${...} с балансировкой скобок.
    while (i < n) {
      const c = text[i];
      if (c === "\\") {
        i += 2;
        continue;
      }
      if (c === "`") return i + 1;
      if (c === "$" && text[i + 1] === "{") {
        i += 2;
        let depth = 1;
        while (i < n && depth > 0) {
          const d = text[i];
          if (d === "\\") {
            i += 2;
            continue;
          }
          if (d === "'" || d === '"' || d === "`") {
            i = skipString(text, i);
            continue;
          }
          if (d === "{") depth++;
          else if (d === "}") depth--;
          i++;
        }
        continue;
      }
      i++;
    }
    return n;
  }
  // одинарные/двойные кавычки
  while (i < n) {
    const c = text[i];
    if (c === "\\") {
      i += 2;
      continue;
    }
    if (c === quote) return i + 1;
    i++;
  }
  return n;
}

/** От открывающей '(' найти позицию сбалансированной ')' (пропуская строки/комменты). */
function matchParen(text: string, open: number): number | null {
  let i = open + 1;
  let depth = 1;
  const n = text.length;
  while (i < n && depth > 0) {
    const c = text[i];
    if (c === "'" || c === '"' || c === "`") {
      i = skipString(text, i);
      continue;
    }
    if (c === "/" && text[i + 1] === "/") {
      const nl = text.indexOf("\n", i);
      i = nl === -1 ? n : nl;
      continue;
    }
    if (c === "/" && text[i + 1] === "*") {
      const end = text.indexOf("*/", i + 2);
      i = end === -1 ? n : end + 2;
      continue;
    }
    if (c === "(") depth++;
    else if (c === ")") depth--;
    i++;
  }
  return depth === 0 ? i - 1 : null;
}

/**
 * Вырезать содержимое строковых литералов, СОХРАНИВ `${...}`-выражения (в них
 * может быть PII-идентификатор). Возвращает «код без литерального текста».
 */
function stripLiterals(code: string): string {
  let out = "";
  let i = 0;
  const n = code.length;
  while (i < n) {
    const c = code[i];
    if (c === "'" || c === '"') {
      i = skipString(code, i);
      out += " ";
      continue;
    }
    if (c === "`") {
      i++;
      while (i < n && code[i] !== "`") {
        if (code[i] === "\\") {
          i += 2;
          continue;
        }
        if (code[i] === "$" && code[i + 1] === "{") {
          i += 2;
          let depth = 1;
          let expr = "";
          while (i < n && depth > 0) {
            const d = code[i];
            if (d === "{") depth++;
            else if (d === "}") {
              depth--;
              if (depth === 0) break;
            }
            expr += d;
            i++;
          }
          i++; // закрывающая }
          out += " " + stripLiterals(expr) + " ";
          continue;
        }
        i++; // литеральный текст template — выкидываем
      }
      i++; // закрывающий `
      out += " ";
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

function lineOf(text: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index && i < text.length; i++) if (text[i] === "\n") line++;
  return line;
}

/** Найти PII-ссылки внутри sink-вызовов. */
export function scanSource(text: string, file = "<mem>"): PiiFinding[] {
  const findings: PiiFinding[] = [];
  SINK_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = SINK_RE.exec(text))) {
    const openParen = m.index + m[0].length - 1;
    const close = matchParen(text, openParen);
    if (close === null) {
      SINK_RE.lastIndex = openParen + 1;
      continue;
    }
    const rawArgs = text.slice(openParen + 1, close);
    const code = stripLiterals(rawArgs);
    const hits: string[] = [];
    for (const { name, re } of PII_TOKENS) if (re.test(code)) hits.push(name);

    if (hits.length) {
      // подавление: `// pii-ok` где-либо в спане вызова (или на строке sink'а)
      const callText = text.slice(m.index, close + 1);
      const lineStart = text.lastIndexOf("\n", m.index) + 1;
      const lineEnd = text.indexOf("\n", close);
      const sinkLines = text.slice(lineStart, lineEnd === -1 ? text.length : lineEnd);
      if (!/\/\/\s*pii-ok/i.test(callText) && !/\/\/\s*pii-ok/i.test(sinkLines)) {
        findings.push({
          file,
          line: lineOf(text, m.index),
          tokens: hits,
          snippet: callText.replace(/\s+/g, " ").slice(0, 160),
        });
      }
    }
    SINK_RE.lastIndex = close + 1;
  }
  return findings;
}
