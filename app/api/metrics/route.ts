import { registry } from "@/lib/metrics"

/**
 * Prometheus scrape endpoint. Public by design — metric data does NOT
 * contain PHI and the route is needed by a Prometheus instance that
 * typically can't (or shouldn't) carry app credentials.
 *
 * If your network policy doesn't isolate Prometheus from internet
 * access, gate this endpoint at the ingress (allow only the
 * Prometheus IP range).
 */
export async function GET(): Promise<Response> {
  const body = await registry.metrics()
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": registry.contentType,
      "Cache-Control": "no-store",
    },
  })
}
