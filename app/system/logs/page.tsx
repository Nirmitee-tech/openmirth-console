import { getMirthClient } from "@/lib/mirth/client"
import { MirthError } from "@/lib/mirth/errors"
import { parseEvents, type ServerEvent } from "@/lib/mirth/system"
import { childLogger } from "@/lib/logger"

const log = childLogger({ component: "system-logs-page" })

export const dynamic = "force-dynamic"

const LEVEL_BADGE: Record<string, string> = {
  ERROR:       "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
  WARNING:     "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200",
  INFORMATION: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
  DEBUG:       "bg-ink-100 text-ink-700 dark:bg-ink-800 dark:text-ink-300",
  TRACE:       "bg-ink-100 text-ink-700 dark:bg-ink-800 dark:text-ink-300",
}

const OUTCOME_DOT: Record<string, string> = {
  SUCCESS: "bg-emerald-500",
  FAILURE: "bg-red-500",
  UNKNOWN: "bg-ink-400",
}

function formatTime(epoch: number): string {
  if (!epoch) return "—"
  return new Date(epoch).toISOString().replace("T", " ").slice(0, 19) + " UTC"
}

export default async function SystemLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ limit?: string; level?: string }>
}) {
  const params = await searchParams
  const limit = Math.min(Math.max(parseInt(params.limit ?? "100", 10) || 100, 1), 500)
  const levelFilter = params.level ?? "ALL"

  let events: ServerEvent[] = []
  let error: string | null = null

  try {
    const xml = await getMirthClient().listEvents(limit, 0)
    events = parseEvents(xml)
  } catch (e) {
    log.error({ err: (e as Error).message }, "system logs fetch failed")
    error = e instanceof MirthError ? e.message : "Unable to load server events"
  }

  const filtered =
    levelFilter === "ALL" ? events : events.filter((e) => e.level === levelFilter)

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink-900 dark:text-ink-100">Server Logs</h1>
          <p className="text-sm text-ink-600 dark:text-ink-400 mt-1">
            Recent events from Mirth&apos;s audit log (most-recent first).
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          {["ALL", "ERROR", "WARNING", "INFORMATION"].map((l) => (
            <a
              key={l}
              href={`/system/logs?limit=${limit}&level=${l}`}
              className={`px-2 py-1 rounded text-xs font-medium ${
                levelFilter === l
                  ? "bg-brand-500 text-white"
                  : "bg-white dark:bg-ink-800 text-ink-700 dark:text-ink-300 hover:bg-ink-100 dark:hover:bg-ink-700 border border-ink-200 dark:border-ink-700"
              }`}
            >
              {l}
            </a>
          ))}
          <span className="text-xs text-ink-600 dark:text-ink-400 ml-3">
            {filtered.length} of {events.length}
          </span>
        </div>
      </header>

      {error ? (
        <div className="rounded border border-red-200 bg-red-50 text-red-900 px-4 py-3 text-sm dark:bg-red-900/40 dark:text-red-200 dark:border-red-800">
          {error}
        </div>
      ) : null}

      <div className="card overflow-hidden">
        <table className="dense w-full">
          <thead>
            <tr>
              <th className="w-[180px]">Time (UTC)</th>
              <th className="w-[120px]">Level</th>
              <th>Event</th>
              <th className="w-[100px]">Outcome</th>
              <th className="w-[120px]">User</th>
              <th className="w-[150px]">IP</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center text-ink-600 dark:text-ink-400 py-8">
                  No events match the current filter.
                </td>
              </tr>
            ) : null}
            {filtered.map((e) => (
              <tr key={e.id}>
                <td className="font-mono text-xs">{formatTime(e.eventTime)}</td>
                <td>
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${LEVEL_BADGE[e.level] ?? LEVEL_BADGE.INFORMATION}`}>
                    {e.level}
                  </span>
                </td>
                <td>
                  <div className="text-sm text-ink-900 dark:text-ink-100">{e.name}</div>
                  {Object.keys(e.attributes).length > 0 ? (
                    <details className="text-xs text-ink-600 dark:text-ink-400 mt-1">
                      <summary className="cursor-pointer">
                        {Object.keys(e.attributes).length} attribute{Object.keys(e.attributes).length === 1 ? "" : "s"}
                      </summary>
                      <dl className="mt-1 grid grid-cols-[max-content_1fr] gap-x-3 gap-y-0.5">
                        {Object.entries(e.attributes).map(([k, v]) => (
                          <div key={k} className="contents">
                            <dt className="text-ink-500">{k}</dt>
                            <dd className="font-mono break-all">{v}</dd>
                          </div>
                        ))}
                      </dl>
                    </details>
                  ) : null}
                </td>
                <td>
                  <span className="inline-flex items-center gap-1.5 text-xs">
                    <span className={`inline-block w-1.5 h-1.5 rounded-full ${OUTCOME_DOT[e.outcome] ?? OUTCOME_DOT.UNKNOWN}`} />
                    {e.outcome}
                  </span>
                </td>
                <td className="font-mono text-xs">{e.userId || "—"}</td>
                <td className="font-mono text-xs">{e.ipAddress || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
