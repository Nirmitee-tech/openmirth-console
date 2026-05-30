import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { _resetEnvForTests } from "@/lib/env"
import { _resetMirthClientForTests, getMirthClient, MirthClient } from "@/lib/mirth/client"
import { MirthAuthError } from "@/lib/mirth/errors"

/**
 * Integration tests against a live Mirth Connect.
 *
 * Skipped automatically if no Mirth is available — the CI workflow
 * starts one before running this suite.
 *
 * These tests use READ-only operations and do not mutate the target.
 */
const MIRTH_URL = process.env.MIRTH_URL ?? "https://localhost:8443"
const USER = process.env.MIRTH_USER ?? "admin"
const PASS = process.env.MIRTH_PASS ?? "admin"

async function isMirthReachable(): Promise<boolean> {
  const probe = new MirthClient(MIRTH_URL, USER, PASS, { insecureSkipVerify: true })
  try {
    await probe.serverVersion()
    return true
  } catch {
    return false
  }
}

describe.runIf((process.env.SKIP_INTEGRATION ?? "0") !== "1")(
  "MirthClient (live)",
  () => {
    let reachable = false
    beforeAll(async () => {
      reachable = await isMirthReachable()
      if (!reachable) {
        console.warn(
          `Mirth at ${MIRTH_URL} is unreachable; skipping live integration tests. ` +
            `Start the demo stack or set SKIP_INTEGRATION=1.`
        )
      }
      _resetEnvForTests()
      _resetMirthClientForTests()
      // Cast through Record for write access — Node's process.env is
      // typed as ReadonlyMap-like in newer @types/node.
      const e = process.env as unknown as Record<string, string>
      e.SESSION_PASSWORD = "x".repeat(40)
      e.MIRTH_URL = MIRTH_URL
      e.MIRTH_USER = USER
      e.MIRTH_PASS = PASS
      e.MIRTH_INSECURE_SKIP_VERIFY = "true"
      e.NODE_ENV = "test"
    })
    afterAll(() => {
      _resetMirthClientForTests()
      _resetEnvForTests()
    })

    it.runIf(true)("returns a SemVer-like server version", async () => {
      if (!reachable) return
      const v = await getMirthClient().serverVersion()
      expect(v).toMatch(/^\d+\.\d+\.\d+/)
    })

    it("lists at least one channel and one dashboard status", async () => {
      if (!reachable) return
      const channels = await getMirthClient().listChannels()
      const statuses = await getMirthClient().listStatuses()
      // The cookbook demo always has at least the ADT channel.
      expect(channels.length).toBeGreaterThanOrEqual(1)
      expect(statuses.length).toBeGreaterThanOrEqual(1)
      // Schema invariant: every status has a real UUID
      for (const s of statuses) {
        expect(s.channelId).toMatch(/^[0-9a-f-]{36}$/)
      }
    })

    it("joins channels with statuses without losing rows", async () => {
      if (!reachable) return
      const combined = await getMirthClient().listChannelsWithStatus()
      expect(combined.length).toBeGreaterThanOrEqual(1)
      for (const c of combined) {
        expect(typeof c.state).toBe("string")
        expect(typeof c.statistics.received).toBe("number")
      }
    })

    it("re-logs in transparently when the cookie expires", async () => {
      if (!reachable) return
      const client = new MirthClient(MIRTH_URL, USER, PASS, { insecureSkipVerify: true })
      await client.serverVersion()
      // Forcibly clear the cookie to simulate Mirth's session expiry
      ;(client as unknown as { cookieHeader: string | null }).cookieHeader = null
      const v = await client.serverVersion()
      expect(v).toMatch(/^\d+\.\d+\.\d+/)
    })

    it("rejects bad credentials with MirthAuthError", async () => {
      if (!reachable) return
      const bad = new MirthClient(MIRTH_URL, USER, "wrong-password-on-purpose", {
        insecureSkipVerify: true,
      })
      await expect(bad.serverVersion()).rejects.toBeInstanceOf(MirthAuthError)
    })
  }
)
