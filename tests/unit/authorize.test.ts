import { describe, expect, it } from "vitest"
import { AuthError, verifyCsrf } from "@/lib/auth/authorize"

describe("verifyCsrf", () => {
  it("accepts a matching token", () => {
    const t = "a".repeat(64)
    expect(() => verifyCsrf(t, t)).not.toThrow()
  })
  it("rejects null / undefined / empty", () => {
    expect(() => verifyCsrf(null, "x".repeat(64))).toThrow(AuthError)
    expect(() => verifyCsrf(undefined, "x".repeat(64))).toThrow(AuthError)
    expect(() => verifyCsrf("", "x".repeat(64))).toThrow(AuthError)
  })
  it("rejects different-length tokens", () => {
    expect(() => verifyCsrf("a".repeat(63), "a".repeat(64))).toThrow(AuthError)
  })
  it("rejects same-length but differing tokens", () => {
    expect(() => verifyCsrf("a".repeat(64), "b".repeat(64))).toThrow(AuthError)
  })
})

describe("AuthError", () => {
  it("carries an HTTP status code", () => {
    const e = new AuthError(403, "denied")
    expect(e.status).toBe(403)
    expect(e.message).toBe("denied")
  })
})
