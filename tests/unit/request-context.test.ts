import { describe, expect, it } from "vitest"
import { generateRequestId, getRequestId, runWithRequestId } from "@/lib/request-context"

describe("request-context", () => {
  it("generateRequestId produces 32 hex chars", () => {
    expect(generateRequestId()).toMatch(/^[0-9a-f]{32}$/)
  })
  it("getRequestId returns the AsyncLocalStorage value inside runWithRequestId", () => {
    const id = generateRequestId()
    runWithRequestId(id, () => {
      expect(getRequestId()).toBe(id)
    })
  })
  it("getRequestId falls back to 'no-context' outside a run", () => {
    expect(getRequestId()).toBe("no-context")
  })
  it("nested runWithRequestId scopes correctly", () => {
    runWithRequestId("outer", () => {
      expect(getRequestId()).toBe("outer")
      runWithRequestId("inner", () => {
        expect(getRequestId()).toBe("inner")
      })
      expect(getRequestId()).toBe("outer")
    })
  })
})
