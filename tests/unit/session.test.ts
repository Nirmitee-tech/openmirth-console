import { describe, expect, it } from "vitest"
import { generateCsrfToken } from "@/lib/auth/session"

describe("generateCsrfToken", () => {
  it("returns 64 lowercase hex chars (32 random bytes)", () => {
    const t = generateCsrfToken()
    expect(t).toMatch(/^[0-9a-f]{64}$/)
  })
  it("produces distinct values across calls", () => {
    const set = new Set(Array.from({ length: 100 }, () => generateCsrfToken()))
    expect(set.size).toBe(100)
  })
})
