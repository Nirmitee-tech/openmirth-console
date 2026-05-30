import { NextResponse } from "next/server"
import { getMirthClient } from "@/lib/mirth/client"
import { upstreamMirthUp } from "@/lib/metrics"
import { childLogger } from "@/lib/logger"

const log = childLogger({ component: "readyz" })

/**
 * Readiness probe — returns 200 only if all upstream dependencies are
 * reachable. Use as Kubernetes readinessProbe so Kubelet stops sending
 * traffic when Mirth is down.
 *
 * Cache result for 5s so a Prometheus scrape every 15s doesn't generate
 * a Mirth login storm.
 */
let cached: { ts: number; ok: boolean; mirthVersion?: string } | null = null
const TTL_MS = 5_000

async function check(): Promise<{ ok: boolean; mirthVersion?: string }> {
  try {
    const version = await getMirthClient().serverVersion()
    upstreamMirthUp.set(1)
    return { ok: true, mirthVersion: version }
  } catch (e) {
    log.warn({ err: (e as Error).message }, "readiness check failed")
    upstreamMirthUp.set(0)
    return { ok: false }
  }
}

export async function GET(): Promise<NextResponse> {
  const now = Date.now()
  if (cached && now - cached.ts < TTL_MS) {
    return NextResponse.json(
      { status: cached.ok ? "ok" : "degraded", mirth: cached.mirthVersion ?? null },
      {
        status: cached.ok ? 200 : 503,
        headers: { "Cache-Control": "no-store" },
      }
    )
  }
  const result = await check()
  cached = { ts: now, ...result }
  return NextResponse.json(
    { status: result.ok ? "ok" : "degraded", mirth: result.mirthVersion ?? null },
    {
      status: result.ok ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    }
  )
}
