import { NextResponse } from "next/server"

/**
 * Liveness probe — always returns 200 unless the process itself is dead.
 * Use as Kubernetes livenessProbe.
 */
export function GET(): NextResponse {
  return NextResponse.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } })
}
