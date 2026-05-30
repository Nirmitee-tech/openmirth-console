import { expect, test } from "@playwright/test"

test.use({
  storageState: undefined,
})

async function login(page: import("@playwright/test").Page) {
  await page.goto("/login")
  await page.getByLabel("Username").fill("admin")
  await page.getByLabel("Password").fill("admin")
  await page.getByRole("button", { name: /sign in/i }).click()
  await expect(page).toHaveURL("/")
}

test.describe("Channels", () => {
  test("dashboard shows live Mirth channels", async ({ page }) => {
    await login(page)
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible()
    await expect(page.getByText(/Live view from Mirth Connect 4\./)).toBeVisible()
  })

  test("channels list renders rows and links to detail", async ({ page }) => {
    await login(page)
    await page.getByRole("link", { name: "Channels" }).first().click()
    await expect(page).toHaveURL(/\/channels$/)
    await expect(page.getByRole("heading", { name: "Channels" })).toBeVisible()

    // The cookbook demo has multiple channels — pick the first link and follow it
    const firstLink = page.locator("table.dense tbody tr a").first()
    const channelName = (await firstLink.textContent())?.trim()
    expect(channelName).toBeTruthy()
    await firstLink.click()

    // Detail page renders, with stat cards + state badge
    await expect(page.getByText(/Message flow/)).toBeVisible()
    await expect(page.getByText("Received")).toBeVisible()
    await expect(page.getByText("Sent")).toBeVisible()
  })
})
