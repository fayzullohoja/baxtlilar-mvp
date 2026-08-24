import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  // Адаптер node-pg (query-builder) намеренно использует `any` для строк результата:
  // он повторяет нетипизированную поверхность supabase-js, чтобы 60+ call-site'ов
  // получали `any[]`/`any` и их .map()/.filter() не падали в implicit-any. Здесь
  // `any` — несущий выбор дизайна (см. шапку файла), а не недосмотр; отключаем
  // правило точечно для этих двух файлов, чтобы `pnpm lint` снова был зелёным и
  // ловил НОВЫЕ нарушения в остальном коде.
  {
    files: ["src/lib/db/query-builder.ts", "src/lib/db/query-builder.test.ts"],
    rules: { "@typescript-eslint/no-explicit-any": "off" },
  },
  // Соглашение «подчёркивание = намеренно не используется» в коде уже
  // применялось (`_req` в роутах, `_raw` в моках), но линтер о нём не знал и
  // ругался. Из-за этого предупреждения копились и на них перестали смотреть -
  // а вместе с ними терялись и настоящие. Теперь соглашение работает: значит
  // всякое оставшееся предупреждение об unused - настоящее.
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
        },
      ],
    },
  },
]);

export default eslintConfig;
