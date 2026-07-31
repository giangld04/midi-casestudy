// Playwright config for AMA-MIDI e2e deliverables.
//
// Prerequisites (a real full stack — no mocks):
//   1. Postgres + Redis up:      docker compose up -d
//   2. API running on :3000:     pnpm --filter @ama-midi/api dev
//   3. Web dev server on :5173:  started automatically below (Vite proxies /api → :3000)
//
// The web dev server is auto-started; the API + infra must be running first
// (they own the database and socket layer these tests exercise).
import { defineConfig, devices } from "@playwright/test";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:5173";
const IS_CI = !!process.env.CI;

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false, // shared DB/song state → run serially for determinism
  forbidOnly: IS_CI,
  retries: IS_CI ? 1 : 0,
  workers: 1,
  reporter: IS_CI ? [["list"], ["html", { open: "never" }]] : "list",
  timeout: 30_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    // page.request POSTs (used by the boundary spec) don't set an Origin the way
    // a browser fetch does; supply a trusted one so the API's CSRF guard passes.
    extraHTTPHeaders: { Origin: BASE_URL },
  },

  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],

  // Start only the web app; API + Postgres + Redis are external dependencies.
  webServer: {
    command: "pnpm --filter @ama-midi/web dev",
    url: BASE_URL,
    reuseExistingServer: !IS_CI,
    timeout: 60_000,
    cwd: "..",
  },
});
