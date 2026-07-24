import { defineConfig } from "vitest/config";
import path from "node:path";

// Интеграционные тесты (*.itest.ts) — гоняются ТОЛЬКО через
// scripts/test-db/run-integration-tests.sh против эфемерной сид-БД (реальный
// Postgres + реальный query-builder). Из обычного `pnpm test:run` исключены
// (тот берёт только *.test.ts), т.к. требуют живой БД по DATABASE_URL.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.itest.ts"],
    globals: false,
    setupFiles: ["src/test/setup-env.ts"], // DATABASE_URL из harness не перезатирается (??=)
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "server-only": path.resolve(__dirname, "src/test/server-only-stub.ts"),
    },
  },
});
