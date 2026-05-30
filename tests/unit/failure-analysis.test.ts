import { describe, expect, it } from "vitest"
import { buildFailureBreakdown, failuresByConnector } from "@/lib/mirth/failure-analysis"
import type { MirthMessage } from "@/lib/mirth/messages"

function msg(
  id: string,
  ts: number,
  connectors: Array<{
    metaDataId: number
    name: string
    status: "RECEIVED" | "TRANSFORMED" | "SENT" | "ERROR" | "QUEUED" | "FILTERED"
    raw?: string | null
    transformed?: string | null
    encoded?: string | null
    response?: string | null
  }>
): MirthMessage {
  return {
    messageId: id,
    receivedAt: ts,
    processed: true,
    connectors: connectors.map((c) => ({
      metaDataId: c.metaDataId,
      connectorName: c.name,
      status: c.status,
      raw: c.raw ?? null,
      transformed: c.transformed ?? null,
      encoded: c.encoded ?? null,
      response: c.response ?? null,
      truncated: false,
    })),
  }
}

describe("buildFailureBreakdown", () => {
  it("counts ERROR + QUEUED totals across all connectors", () => {
    const messages: MirthMessage[] = [
      msg("1", 1000, [
        { metaDataId: 0, name: "Source", status: "TRANSFORMED" },
        { metaDataId: 1, name: "FHIR", status: "ERROR", transformed: "<x>", response: "500 Internal Server Error" },
      ]),
      msg("2", 2000, [
        { metaDataId: 0, name: "Source", status: "TRANSFORMED" },
        { metaDataId: 1, name: "FHIR", status: "QUEUED" },
        { metaDataId: 2, name: "CSV", status: "SENT" },
      ]),
      msg("3", 3000, [
        { metaDataId: 0, name: "Source", status: "ERROR", raw: "MSH|..." },
      ]),
    ]
    const b = buildFailureBreakdown(messages)
    expect(b.totalErrors).toBe(2)
    expect(b.totalQueued).toBe(1)
  })

  it("groups failures by connector and orders by error count desc", () => {
    const messages: MirthMessage[] = [
      msg("1", 1, [{ metaDataId: 1, name: "A", status: "ERROR", transformed: "x" }]),
      msg("2", 2, [{ metaDataId: 1, name: "A", status: "ERROR", transformed: "x" }]),
      msg("3", 3, [{ metaDataId: 2, name: "B", status: "ERROR", transformed: "x" }]),
    ]
    const b = buildFailureBreakdown(messages)
    expect(b.byConnector).toHaveLength(2)
    expect(b.byConnector[0].metaDataId).toBe(1)
    expect(b.byConnector[0].errorCount).toBe(2)
    expect(b.byConnector[1].metaDataId).toBe(2)
  })

  it("infers worstStage='transform' when destination has no transformed payload", () => {
    const b = buildFailureBreakdown([
      msg("1", 1, [
        { metaDataId: 1, name: "D", status: "ERROR", raw: "input", transformed: null },
      ]),
    ])
    expect(b.byConnector[0].worstStage).toBe("transform")
  })

  it("infers worstStage='dispatch' when transformed exists but encoded does not", () => {
    const b = buildFailureBreakdown([
      msg("1", 1, [
        { metaDataId: 1, name: "D", status: "ERROR", transformed: "ok", encoded: null },
      ]),
    ])
    expect(b.byConnector[0].worstStage).toBe("dispatch")
  })

  it("captures the most-recent error excerpt per connector", () => {
    const b = buildFailureBreakdown([
      msg("100", 100, [
        { metaDataId: 1, name: "D", status: "ERROR", transformed: "x", response: "first failure body" },
      ]),
      msg("101", 200, [
        { metaDataId: 1, name: "D", status: "ERROR", transformed: "x", response: "later failure body" },
      ]),
    ])
    // Newest first, so lastErrorExcerpt should be from the t=200 message
    expect(b.byConnector[0].lastErrorAt).toBe(200)
    expect(b.byConnector[0].lastErrorExcerpt).toContain("later failure body")
  })

  it("emits a flat recentErrors list capped at 10", () => {
    const many: MirthMessage[] = Array.from({ length: 30 }, (_, i) =>
      msg(`${i}`, i * 100, [
        { metaDataId: 1, name: "D", status: "ERROR", response: `error ${i}` },
      ])
    )
    const b = buildFailureBreakdown(many)
    expect(b.recentErrors).toHaveLength(10)
    // Newest first
    expect(b.recentErrors[0].messageId).toBe("29")
  })
})

describe("failuresByConnector helper", () => {
  it("returns a flat metaDataId → errorCount map", () => {
    const b = buildFailureBreakdown([
      msg("1", 1, [{ metaDataId: 1, name: "A", status: "ERROR", transformed: "x" }]),
      msg("2", 2, [{ metaDataId: 2, name: "B", status: "ERROR", transformed: "x" }]),
    ])
    expect(failuresByConnector(b)).toEqual({ 1: 1, 2: 1 })
  })
})
