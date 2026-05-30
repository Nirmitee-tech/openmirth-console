/**
 * Next.js startup hook.
 * Called once per server process before the first request.
 *
 * We use it to start the timeseries sampler (in-memory rolling window
 * of per-channel throughput rates for the dashboard sparklines).
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { ensureSampler } = await import("@/lib/timeseries")
    ensureSampler()
  }
}
