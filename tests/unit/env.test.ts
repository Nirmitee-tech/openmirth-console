import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { _resetEnvForTests, getEnv } from "@/lib/env"

const REQUIRED: Record<string, string> = {
  MIRTH_URL: "https://example.invalid:8443",
  MIRTH_USER: "admin",
  MIRTH_PASS: "admin",
  SESSION_PASSWORD: "0123456789012345678901234567890123456789", // 40 chars
  NODE_ENV: "test",
}

function withEnv(overrides: Record<string, string | undefined>, fn: () => void) {
  const original = { ...process.env }
  for (const k of Object.keys(process.env)) delete process.env[k]
  Object.assign(process.env, REQUIRED, overrides)
  try {
    fn()
  } finally {
    for (const k of Object.keys(process.env)) delete process.env[k]
    Object.assign(process.env, original)
    _resetEnvForTests()
  }
}

describe("getEnv", () => {
  beforeEach(() => _resetEnvForTests())
  afterEach(() => _resetEnvForTests())

  it("returns a validated env object when all required fields are present", () => {
    withEnv({}, () => {
      const env = getEnv()
      expect(env.MIRTH_URL).toBe("https://example.invalid:8443")
      expect(env.MIRTH_USER).toBe("admin")
      expect(env.SESSION_TTL_SECONDS).toBe(8 * 60 * 60)
      expect(env.MIRTH_INSECURE_SKIP_VERIFY).toBe(false)
      expect(env.OMCC_ROLE_ADMIN).toBe("")
      expect(env.OMCC_ROLE_OPERATOR).toBe("")
      expect(env.OMCC_ROLE_VIEWER).toBe("")
    })
  })

  it("propagates role mapping env vars verbatim", () => {
    withEnv(
      {
        OMCC_ROLE_ADMIN: "alice,bob",
        OMCC_ROLE_OPERATOR: "*",
        OMCC_ROLE_VIEWER: "everyone-else",
      },
      () => {
        const env = getEnv()
        expect(env.OMCC_ROLE_ADMIN).toBe("alice,bob")
        expect(env.OMCC_ROLE_OPERATOR).toBe("*")
        expect(env.OMCC_ROLE_VIEWER).toBe("everyone-else")
      }
    )
  })

  it("rejects a SESSION_PASSWORD shorter than 32 chars", () => {
    withEnv({ SESSION_PASSWORD: "too-short" }, () => {
      expect(() => getEnv()).toThrow(/SESSION_PASSWORD must be at least 32/)
    })
  })

  it("rejects a MIRTH_URL that is not http(s)", () => {
    withEnv({ MIRTH_URL: "ftp://nope" }, () => {
      expect(() => getEnv()).toThrow()
    })
  })

  it("coerces SESSION_TTL_SECONDS to a positive integer", () => {
    withEnv({ SESSION_TTL_SECONDS: "60" }, () => {
      expect(getEnv().SESSION_TTL_SECONDS).toBe(60)
    })
  })

  it("forbids MIRTH_INSECURE_SKIP_VERIFY=true in production", () => {
    withEnv(
      {
        NODE_ENV: "production",
        MIRTH_INSECURE_SKIP_VERIFY: "true",
      },
      () => {
        expect(() => getEnv()).toThrow(/forbidden in production/)
      }
    )
  })

  it("caches the parsed env across calls", () => {
    withEnv({}, () => {
      const a = getEnv()
      const b = getEnv()
      expect(a).toBe(b)
    })
  })
})
