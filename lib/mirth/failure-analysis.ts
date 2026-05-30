/**
 * Aggregate recent-message failures by which connector + stage caused them.
 *
 * The Mirth message endpoint already returns per-connector status. We walk
 * the last N messages, count how many ERROR / QUEUED entries each
 * connector has, and surface the most-recent error excerpt so the
 * operator can see what actually went wrong.
 */
import type { MirthMessage, ConnectorPayload } from "./messages"

export interface ConnectorFailureSummary {
  metaDataId: number
  connectorName: string
  errorCount: number
  queuedCount: number
  /** Most-recent error response payload (truncated to 1 KB) */
  lastErrorExcerpt: string | null
  /** Epoch ms of the most-recent failure */
  lastErrorAt: number | null
  /** Stage where most failures landed — derived from the connector's progression */
  worstStage: "filter" | "transform" | "response" | "dispatch" | null
}

export interface FailureBreakdown {
  totalErrors: number
  totalQueued: number
  byConnector: ConnectorFailureSummary[]
  /** Recent ERROR messages — newest first, capped at 10 */
  recentErrors: Array<{
    messageId: string
    receivedAt: number
    connectorName: string
    metaDataId: number
    excerpt: string
  }>
}

function excerptOf(c: ConnectorPayload): string {
  const candidates: Array<string | null> = [c.response, c.transformed, c.encoded, c.raw]
  for (const v of candidates) {
    if (v && v.trim().length > 0) {
      return v.slice(0, 1000)
    }
  }
  return ""
}

/**
 * If a connector ERROR'd, infer which stage broke. Mirth doesn't tell us
 * directly — we deduce from which content fields are populated.
 *   - has raw but no transformed → transform stage failed
 *   - has transformed but no encoded → response/dispatch
 *   - has none → filter or pre-transform
 */
function inferStage(c: ConnectorPayload): ConnectorFailureSummary["worstStage"] {
  if (c.metaDataId === 0) {
    // Source connector
    if (c.raw && !c.transformed) return "transform"
    if (!c.raw) return "filter"
    return "transform"
  }
  // Destination
  if (!c.transformed) return "transform"
  if (c.transformed && !c.encoded) return "dispatch"
  if (c.response) return "response"
  return "dispatch"
}

export function buildFailureBreakdown(messages: MirthMessage[]): FailureBreakdown {
  const byConnector = new Map<number, ConnectorFailureSummary>()
  const recentErrors: FailureBreakdown["recentErrors"] = []
  let totalErrors = 0
  let totalQueued = 0

  // Newest first
  const sorted = [...messages].sort((a, b) => b.receivedAt - a.receivedAt)

  for (const m of sorted) {
    for (const c of m.connectors) {
      if (c.status === "ERROR") totalErrors++
      if (c.status === "QUEUED") totalQueued++
      if (c.status !== "ERROR" && c.status !== "QUEUED") continue

      const existing = byConnector.get(c.metaDataId)
      const errorInc = c.status === "ERROR" ? 1 : 0
      const queuedInc = c.status === "QUEUED" ? 1 : 0
      const stage = inferStage(c)

      if (!existing) {
        byConnector.set(c.metaDataId, {
          metaDataId: c.metaDataId,
          connectorName: c.connectorName,
          errorCount: errorInc,
          queuedCount: queuedInc,
          lastErrorExcerpt: c.status === "ERROR" ? excerptOf(c) : null,
          lastErrorAt: c.status === "ERROR" ? m.receivedAt : null,
          worstStage: c.status === "ERROR" ? stage : null,
        })
      } else {
        existing.errorCount += errorInc
        existing.queuedCount += queuedInc
        if (c.status === "ERROR" && existing.lastErrorAt === null) {
          existing.lastErrorExcerpt = excerptOf(c)
          existing.lastErrorAt = m.receivedAt
          existing.worstStage = stage
        }
      }

      if (c.status === "ERROR" && recentErrors.length < 10) {
        recentErrors.push({
          messageId: m.messageId,
          receivedAt: m.receivedAt,
          connectorName: c.connectorName,
          metaDataId: c.metaDataId,
          excerpt: excerptOf(c).slice(0, 280),
        })
      }
    }
  }

  return {
    totalErrors,
    totalQueued,
    byConnector: Array.from(byConnector.values()).sort(
      (a, b) => b.errorCount - a.errorCount || b.queuedCount - a.queuedCount
    ),
    recentErrors,
  }
}

/** Convert the breakdown's by-connector map to the simple failure count
 *  shape PipelineDiagram expects. */
export function failuresByConnector(b: FailureBreakdown): Record<number, number> {
  const out: Record<number, number> = {}
  for (const c of b.byConnector) {
    out[c.metaDataId] = c.errorCount
  }
  return out
}
