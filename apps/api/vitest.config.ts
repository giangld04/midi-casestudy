import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Integration tests hit a real Postgres; run serially to avoid cross-test
    // interference on shared tables.
    setupFiles: ["./vitest.setup.ts"],
    fileParallelism: false,
    hookTimeout: 20000,
    testTimeout: 20000,
  },
  // Externalize pg and related CJS-only packages so Vite doesn't try to bundle them.
  // better-auth's pg pool import needs pg to be resolved via Node, not Vite.
  server: {
    deps: {
      external: ["pg", "pg-native", "better-auth", "kysely"],
    },
  },
});
