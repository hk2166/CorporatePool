import { defineConfig, devices } from "@playwright/test";

// End-to-end tests (T-8.3): user flows 1–5 and 9 of docs/user-flows.md in a real browser,
// against the local Supabase stack with its demo data and the demo sign-in
// (NEXT_PUBLIC_DEV_LOGIN=true). CI runs them nightly (.github/workflows/e2e.yml). Locally:
//
//   npm run db:start && npm run dev   (in another terminal)
//   npm run test:e2e
//
// The tests share one demo ride, so they run one at a time, in order.

try {
  process.loadEnvFile(".env.local");
} catch {
  // CI sets the environment itself.
}

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://localhost:3000",
    ...devices["Pixel 7"],
    // Locally, the Chrome already installed; CI installs Playwright's Chromium.
    channel: process.env.CI ? undefined : "chrome",
    trace: "retain-on-failure",
  },
  webServer: {
    command: process.env.CI ? "npm run start" : "npm run dev",
    url: "http://localhost:3000/login",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
