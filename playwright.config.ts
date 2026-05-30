import { defineConfig, devices } from "@playwright/test"

/**
 * Playwright E2E configuration.
 *
 * Runs the production build (`npm start`) against a live Mirth Connect.
 * Use --headed locally to see the browser; CI runs headless.
 *
 * Pre-req: the app must reach Mirth at MIRTH_URL. CI starts the same
 * docker-compose stack as the cookbook recipes.
 */
const PORT = Number(process.env.PORT ?? 3030)
const BASE_URL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI
    ? [["html", { open: "never" }], ["github"]]
    : "list",
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    video: "retain-on-failure",
    screenshot: "only-on-failure",
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
  ],
  // CI: rely on a pre-started server. Local: auto-start via npm start.
  webServer: process.env.CI
    ? undefined
    : {
        command: "npm run start",
        url: BASE_URL,
        reuseExistingServer: true,
        timeout: 60_000,
      },
})
