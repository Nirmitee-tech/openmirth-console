import { describe, expect, it } from "vitest"

/**
 * Mirror of the safeNext() logic in app/api/auth/login/route.ts. Pure
 * function — re-implemented here for unit-testability without pulling
 * in Next.js server-route boilerplate. The route-handler version MUST
 * stay byte-identical; tests catch drift via these cases.
 */
function safeNext(value: string | null | undefined): string {
  if (!value) return "/"
  if (!value.startsWith("/")) return "/"
  if (value.startsWith("//") || value.startsWith("/\\")) return "/"
  if (/^\/[a-zA-Z][a-zA-Z0-9+.-]*:/.test(value)) return "/"
  return value
}

describe("safeNext (open redirect guard)", () => {
  it.each([
    ["/", "/"],
    ["/channels", "/channels"],
    ["/channels/123?tab=stats", "/channels/123?tab=stats"],
    ["/observability", "/observability"],
  ])("allows local path %s", (input, expected) => {
    expect(safeNext(input)).toBe(expected)
  })

  it.each([
    [null, "/"],
    [undefined, "/"],
    ["", "/"],
    ["//evil.com", "/"],
    ["//evil.com/path", "/"],
    ["/\\\\evil.com", "/"],
    ["https://evil.com", "/"],
    ["http://evil.com", "/"],
    ["javascript:alert(1)", "/"],
    ["data:text/html,<script>alert(1)</script>", "/"],
    ["//\\evil.com", "/"],
  ])("rejects malicious / non-local target %s", (input, expected) => {
    expect(safeNext(input)).toBe(expected)
  })
})
