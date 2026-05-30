import { getEnv } from "@/lib/env"

export default function ObservabilityPage() {
  const env = getEnv()
  if (!env.GRAFANA_URL) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold text-ink-900 dark:text-ink-100">Observability</h1>
        <div className="rounded border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-800 p-6 text-sm text-ink-600 dark:text-ink-400">
          The observability dashboard isn&apos;t configured. Set <code>GRAFANA_URL</code> in your
          env to the Grafana instance from the{" "}
          <a
            href="https://github.com/Nirmitee-tech/mirth-connect-cookbook/tree/main/docker/hospital-operations-dashboard"
            className="text-brand-500 underline underline-offset-4"
            rel="noreferrer"
            target="_blank"
          >
            hospital-operations-dashboard
          </a>{" "}
          recipe.
        </div>
      </div>
    )
  }
  return (
    <div className="-mt-8 -mx-6 h-[calc(100vh-8rem)]">
      <iframe
        src={`${env.GRAFANA_URL}/d/hospital-ops/hospital-integration-operations?kiosk=tv`}
        className="w-full h-full border-0"
        title="Hospital Operations Dashboard"
      />
    </div>
  )
}
