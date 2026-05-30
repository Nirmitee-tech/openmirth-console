import { AsyncLocalStorage } from "node:async_hooks"
import { headers } from "next/headers"

/**
 * Per-request context carrying a stable correlation ID.
 *
 * Next.js exposes `headers()` inside server components, so for those we
 * derive the id from the X-Request-ID header set by middleware. For
 * non-component code paths (API routes, route handlers) we plumb the
 * id explicitly via AsyncLocalStorage.
 */
const storage = new AsyncLocalStorage<{ requestId: string }>()

export function runWithRequestId<T>(requestId: string, fn: () => T): T {
  return storage.run({ requestId }, fn)
}

/* v8 ignore start — covered by Playwright E2E; requires Next.js runtime */
export async function getRequestIdFromHeaders(): Promise<string> {
  const h = await headers()
  return h.get("x-request-id") ?? generateRequestId()
}
/* v8 ignore stop */

export function getRequestId(): string {
  return storage.getStore()?.requestId ?? "no-context"
}

export function generateRequestId(): string {
  // 16 random bytes hex — 128 bits, more than enough collision resistance
  // across a single deploy.
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")
}
