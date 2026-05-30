import { expect, test } from "@playwright/test"

test.describe("Authentication", () => {
  test("unauthenticated user is redirected to /login", async ({ page }) => {
    await page.goto("/")
    await expect(page).toHaveURL(/\/login\?next=/)
    await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible()
  })

  test("login with bad credentials surfaces an inline error", async ({ page }) => {
    await page.goto("/login")
    await page.getByLabel("Username").fill("admin")
    await page.getByLabel("Password").fill("definitely-not-the-password")
    await page.getByLabel("Role").selectOption("viewer")
    await page.getByRole("button", { name: /sign in/i }).click()
    await expect(page.getByText(/invalid credentials/i)).toBeVisible()
  })

  test("successful login lands on the dashboard", async ({ page }) => {
    await page.goto("/login")
    await page.getByLabel("Username").fill("admin")
    await page.getByLabel("Password").fill("admin")
    await page.getByLabel("Role").selectOption("admin")
    await page.getByRole("button", { name: /sign in/i }).click()
    await expect(page).toHaveURL("/")
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible()
    await expect(page.getByText(/STARTED/)).toBeVisible()
  })

  test("logout clears the session", async ({ page, context }) => {
    // Login
    await page.goto("/login")
    await page.getByLabel("Username").fill("admin")
    await page.getByLabel("Password").fill("admin")
    await page.getByRole("button", { name: /sign in/i }).click()
    await expect(page).toHaveURL("/")
    // Logout
    await page.getByRole("button", { name: /sign out/i }).click()
    await page.waitForLoadState("networkidle")
    // Cookie should be gone
    const cookies = await context.cookies()
    expect(cookies.find((c) => c.name === "openmirth_session")?.value ?? "").toBe("")
    // Navigating back to / redirects to login
    await page.goto("/")
    await expect(page).toHaveURL(/\/login/)
  })
})

test.describe("Health endpoints", () => {
  test("/api/healthz returns 200 OK", async ({ request }) => {
    const r = await request.get("/api/healthz")
    expect(r.status()).toBe(200)
    expect(await r.json()).toEqual({ status: "ok" })
  })

  test("/api/readyz reports the live Mirth version", async ({ request }) => {
    const r = await request.get("/api/readyz")
    expect(r.status()).toBe(200)
    const body = (await r.json()) as { status: string; mirth: string | null }
    expect(body.status).toBe("ok")
    expect(body.mirth).toMatch(/^\d+\.\d+\.\d+/)
  })

  test("/api/metrics returns Prometheus text", async ({ request }) => {
    const r = await request.get("/api/metrics")
    expect(r.status()).toBe(200)
    const text = await r.text()
    expect(text).toContain("openmirth_process_cpu_user_seconds_total")
    expect(text).toContain("openmirth_upstream_mirth_up")
  })
})
