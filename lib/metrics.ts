import { Counter, Gauge, Histogram, Registry, collectDefaultMetrics } from "prom-client"

/**
 * Application-level Prometheus metrics.
 *
 * Exposed at /api/metrics. Scrape with Prometheus (the same one used by
 * the hospital-operations-dashboard recipe). Default Node.js metrics
 * (heap, GC, event loop lag) are included.
 */

export const registry = new Registry()
collectDefaultMetrics({ register: registry, prefix: "openmirth_" })

export const httpRequestsTotal = new Counter({
  name: "openmirth_http_requests_total",
  help: "HTTP requests handled by openmirth-console",
  labelNames: ["method", "route", "status"] as const,
  registers: [registry],
})

export const httpRequestDuration = new Histogram({
  name: "openmirth_http_request_duration_seconds",
  help: "HTTP request duration by route",
  labelNames: ["method", "route", "status"] as const,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [registry],
})

export const mirthRequestsTotal = new Counter({
  name: "openmirth_mirth_requests_total",
  help: "Calls to the underlying Mirth REST API",
  labelNames: ["operation", "outcome"] as const,
  registers: [registry],
})

export const mirthRequestDuration = new Histogram({
  name: "openmirth_mirth_request_duration_seconds",
  help: "Mirth REST call duration",
  labelNames: ["operation"] as const,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [registry],
})

export const authEvents = new Counter({
  name: "openmirth_auth_events_total",
  help: "Authentication / authorization events",
  labelNames: ["kind", "outcome"] as const,
  registers: [registry],
})

export const upstreamMirthUp = new Gauge({
  name: "openmirth_upstream_mirth_up",
  help: "1 if the configured Mirth is reachable from the readiness check, else 0",
  registers: [registry],
})
