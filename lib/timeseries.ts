/**
 * Per-channel throughput timeseries — collected in-process by sampling
 * Mirth's received counter on a fixed interval and converting deltas
 * into a per-second rate.
 *
 * The buffer is bounded (default 30 samples = last 5 minutes at 10s
 * intervals) and lives in module memory — restarted on every pod
 * recycle. That's the right scope for an at-a-glance sparkline; for
 * persistent timeseries use the Prometheus + Grafana stack from the
 * hospital-operations-dashboard cookbook recipe (which this app
 * embeds as the Observability tab).
 */
import { getMirthClient } from "@/lib/mirth/client"
import { childLogger } from "@/lib/logger"

const log = childLogger({ component: "timeseries" })

const SAMPLE_INTERVAL_MS = 10_000
const BUFFER_SIZE = 30

interface ChannelHistory {
  // Sliding window of per-second rates (most-recent at the end)
  ratePerSecond: number[]
  // Most recent absolute counter we saw, used to derive deltas
  lastReceived: number
  lastSampleAt: number
  // Carry the human-readable channel name for the API consumer
  name: string
}

const histories = new Map<string, ChannelHistory>()
let started = false

async function sample(): Promise<void> {
  try {
    const statuses = await getMirthClient().listStatuses()
    const now = Date.now()
    for (const s of statuses) {
      const prev = histories.get(s.channelId)
      if (!prev) {
        histories.set(s.channelId, {
          ratePerSecond: [],
          lastReceived: s.statistics.received,
          lastSampleAt: now,
          name: s.name,
        })
        continue
      }
      const dt = (now - prev.lastSampleAt) / 1000
      const dn = s.statistics.received - prev.lastReceived
      const rate = dt > 0 && dn >= 0 ? dn / dt : 0
      prev.ratePerSecond.push(rate)
      while (prev.ratePerSecond.length > BUFFER_SIZE) prev.ratePerSecond.shift()
      prev.lastReceived = s.statistics.received
      prev.lastSampleAt = now
      prev.name = s.name
    }
  } catch (e) {
    log.warn({ err: (e as Error).message }, "timeseries sample failed")
  }
}

export function ensureSampler(): void {
  if (started) return
  started = true
  // Initial sample on the next tick so callers can read something soon.
  setTimeout(() => {
    void sample()
  }, 250)
  // Periodic sampler.
  const handle = setInterval(() => {
    void sample()
  }, SAMPLE_INTERVAL_MS)
  // Allow Node to exit cleanly during tests / SIGTERM.
  if (typeof handle.unref === "function") handle.unref()
}

export function getHistory(channelId: string): { name: string; rates: number[] } | null {
  const h = histories.get(channelId)
  if (!h) return null
  return { name: h.name, rates: [...h.ratePerSecond] }
}

export function getAllHistories(): Array<{ id: string; name: string; rates: number[] }> {
  return Array.from(histories.entries()).map(([id, h]) => ({
    id,
    name: h.name,
    rates: [...h.ratePerSecond],
  }))
}

/** Test helper — clears the in-memory buffer so tests don't bleed. */
export function _resetForTests(): void {
  histories.clear()
  started = false
}
