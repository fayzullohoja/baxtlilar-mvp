import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { scanSource } from "./pii-log-scan";

// C-012: (1) логика сканера на фикстурах, (2) baseline — весь src/ чист.

describe("scanSource — детект PII в sink-вызовах", () => {
  it("флагует прямую ссылку на PII-поле", () => {
    const f = scanSource(`console.log("user", user.phone);`);
    expect(f).toHaveLength(1);
    expect(f[0].tokens).toContain("phone");
  });

  it("флагует PII внутри ${...} template-интерполяции", () => {
    const f = scanSource("console.error(`tg id ${user.telegram_id} failed`);");
    expect(f).toHaveLength(1);
    expect(f[0].tokens).toContain("telegram_id");
  });

  it("флагует selfie_path / passport_path", () => {
    expect(scanSource(`console.log(doc.selfie_path)`)[0].tokens).toContain("selfie");
    expect(scanSource(`captureMessage(user.passport_path)`)[0].tokens).toContain("passport");
  });

  it("флагует будущие analytics/event sink'и", () => {
    expect(scanSource(`track("signup", { phone_number: u.phone_number })`).length).toBe(1);
    expect(scanSource(`analytics.emit({ religion: p.religion })`)[0].tokens).toContain("religion");
  });

  it("НЕ флагует PII-слово внутри строкового литерала (тег/текст лога)", () => {
    expect(scanSource(`console.error("[selfie] upload failed:", err.message)`)).toHaveLength(0);
    expect(
      scanSource(`console.error("[account.delete] phone_blacklist insert failed:", bErr.message)`),
    ).toHaveLength(0);
    expect(scanSource(`console.error("[health] db check threw", e)`)).toHaveLength(0);
  });

  it("НЕ флагует phone_verified (boolean, не ПД)", () => {
    expect(scanSource(`console.log("verified?", user.phone_verified)`)).toHaveLength(0);
    expect(scanSource(`console.log("at", user.phone_verified_at)`)).toHaveLength(0);
  });

  it("НЕ флагует безопасные агрегаты", () => {
    expect(scanSource(`console.log("count", items.length)`)).toHaveLength(0);
    expect(scanSource(`console.error("[cron] outbox drained:", n)`)).toHaveLength(0);
  });

  it("строка со скобкой ) не ломает балансировку", () => {
    expect(scanSource(`console.error("oops :) retry", e)`)).toHaveLength(0);
  });

  it("// pii-ok подавляет находку", () => {
    expect(scanSource(`console.log(user.phone); // pii-ok: masked`)).toHaveLength(0);
  });

  it("biometric НЕ ложно-матчится на \\bbio\\b", () => {
    expect(scanSource(`console.log("biometric consent", hasActiveBiometricConsent)`)).toHaveLength(0);
  });
});

// ── Baseline: реальный src/ не должен содержать PII в логах ──────────────────
function walk(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) {
      walk(p, acc);
    } else if (/\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name)) {
      // исключаем сам сканер (в нём токен-лист как данные, не как лог)
      if (p.endsWith(join("security", "pii-log-scan.ts"))) continue;
      acc.push(p);
    }
  }
  return acc;
}

describe("baseline: src/ не логирует PII", () => {
  it("ни одного sink-вызова с PII-ссылкой", () => {
    const root = join(process.cwd(), "src");
    const files = walk(root);
    const findings = files.flatMap((f) => scanSource(readFileSync(f, "utf8"), f));
    if (findings.length) {
      const report = findings
        .map((x) => `  ${x.file.replace(process.cwd() + "/", "")}:${x.line} [${x.tokens.join(",")}] ${x.snippet}`)
        .join("\n");
      throw new Error(`PII в логах (${findings.length}). Убери значение или добавь // pii-ok: <причина>:\n${report}`);
    }
    expect(findings).toHaveLength(0);
  });
});
