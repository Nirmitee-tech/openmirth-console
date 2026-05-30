/**
 * Capture screenshots of the live console for documentation.
 *
 * Run:
 *   node scripts/screenshots.mjs
 *
 * Requires the dev server running at http://localhost:3030 and at least
 * the admin user mapped to admin role.
 */
import { chromium } from "@playwright/test"
import { mkdir } from "node:fs/promises"
import { join } from "node:path"

const BASE_URL = process.env.SCREENSHOTS_BASE_URL ?? "http://localhost:3030"
const OUT_DIR = process.env.SCREENSHOTS_OUT_DIR ?? join(process.cwd(), "docs/screenshots")
const USERNAME = process.env.SCREENSHOTS_USER ?? "admin"
const PASSWORD = process.env.SCREENSHOTS_PASS ?? "admin"
// CHANNEL_ID can be passed via env; otherwise we'll pick the first one.
const CHANNEL_ID = process.env.SCREENSHOTS_CHANNEL_ID ?? ""
// THEME = "light" | "dark"
const THEME = process.env.SCREENSHOTS_THEME ?? "light"

await mkdir(OUT_DIR, { recursive: true })

const browser = await chromium.launch()
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
})
// Pre-seed the theme preference so the first paint already matches.
await context.addInitScript((theme) => {
  try { localStorage.setItem("omcc-theme", theme) } catch (e) {}
}, THEME === "dark" ? "dark" : "light")
const page = await context.newPage()

console.log(`→ ${BASE_URL}/login`)
await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle" })
await page.getByLabel("Username").fill(USERNAME)
await page.getByLabel("Password").fill(PASSWORD)
await page.getByRole("button", { name: /sign in/i }).click()
await page.waitForURL(`${BASE_URL}/`, { timeout: 15000 })

const targets = [
  { path: "/", name: "01-dashboard.png" },
  { path: "/channels", name: "02-channels-list.png" },
]

let pickedChannelId = CHANNEL_ID
if (!pickedChannelId) {
  await page.goto(`${BASE_URL}/channels`, { waitUntil: "networkidle" })
  const firstHref = await page
    .locator('table.dense tbody tr a[href^="/channels/"]')
    .first()
    .getAttribute("href")
  pickedChannelId = firstHref?.replace(/^\/channels\//, "") ?? ""
  console.log(`Picked channel ${pickedChannelId}`)
}

if (pickedChannelId) {
  targets.push(
    { path: `/channels/${pickedChannelId}`, name: "03-channel-detail.png" },
    { path: `/channels/${pickedChannelId}/scripts`, name: "04-scripts-editor.png" },
    { path: `/channels/${pickedChannelId}/messages`, name: "05-message-browser.png" }
  )
}
targets.push(
  { path: "/mappings", name: "06-mappings.png" },
  { path: "/channels/new", name: "07-new-channel.png" },
  { path: "/system/health", name: "08-system-health.png" },
  { path: "/system/logs", name: "09-system-logs.png" }
)

for (const t of targets) {
  console.log(`→ ${BASE_URL}${t.path}`)
  await page.goto(`${BASE_URL}${t.path}`, { waitUntil: "networkidle", timeout: 20000 })
  // Give CodeMirror / SVG sparklines a beat to render
  await page.waitForTimeout(800)
  const dest = join(OUT_DIR, t.name)
  // Pages with a tall code editor look bad in fullPage mode (one huge tall
  // screenshot). Cap them to viewport so the editor + sidebar are visible
  // without scrolling.
  const isLongPage = t.name.includes("scripts-editor") || t.name.includes("system-logs")
  await page.screenshot({ path: dest, fullPage: !isLongPage })
  console.log(`   saved ${dest}`)
}

await browser.close()
console.log("Done.")
