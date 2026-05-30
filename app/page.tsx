import Link from "next/link"
import { getMirthClient } from "@/lib/mirth/client"
import { MirthError } from "@/lib/mirth/errors"
import { StatCard } from "@/components/StatCard"
import { StateBadge } from "@/components/StateBadge"
import { childLogger } from "@/lib/logger"
import type { ChannelWithStatus } from "@/lib/mirth/schemas"

const log = childLogger({ component: "dashboard-page" })

export const dynamic = "force-dynamic"  // always live data

export default async function Dashboard() {
  let channels: ChannelWithStatus[]
  let version: string | null = null
  let error: string | null = null

  try {
    const client = getMirthClient()
    ;[channels, version] = await Promise.all([
      client.listChannelsWithStatus(),
      client.serverVersion().catch(() => null),
    ])
  } catch (e) {
    log.error({ err: (e as Error).message }, "dashboard fetch failed")
    channels = []
    error =
      e instanceof MirthError
        ? `Could not reach Mirth: ${e.message}`
        : `Unexpected error loading dashboard`
  }

  const totals = channels.reduce(
    (acc, c) => ({
      received: acc.received + c.statistics.received,
      sent: acc.sent + c.statistics.sent,
      errored: acc.errored + c.statistics.errored,
      queued: acc.queued + c.statistics.queued,
      started: acc.started + (c.state === "STARTED" ? 1 : 0),
    }),
    { received: 0, sent: 0, errored: 0, queued: 0, started: 0 }
  )

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-ink-900">Dashboard</h1>
        <p className="text-sm text-ink-600 mt-1">
          Live view from Mirth Connect{version ? ` ${version}` : ""}. Updates on every page load.
        </p>
      </header>

      {error ? (
        <div className="rounded border border-red-200 bg-red-50 text-red-900 px-4 py-3 text-sm">
          <strong className="font-semibold">Connection issue.</strong> {error}
        </div>
      ) : null}

      <section className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard
          label="Channels"
          value={channels.length}
          sub={`${totals.started} STARTED`}
        />
        <StatCard label="Received" value={totals.received.toLocaleString()} sub="messages" />
        <StatCard
          label="Sent"
          value={totals.sent.toLocaleString()}
          sub="downstream"
          tone="good"
        />
        <StatCard
          label="Errors"
          value={totals.errored}
          tone={totals.errored > 0 ? "bad" : "neutral"}
        />
        <StatCard
          label="Queued"
          value={totals.queued}
          tone={totals.queued > 10 ? "bad" : totals.queued > 0 ? "warn" : "neutral"}
        />
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-ink-900">Channels</h2>
          <Link
            href="/channels"
            className="text-sm text-brand-500 hover:underline underline-offset-4"
          >
            View all →
          </Link>
        </div>
        <div className="bg-white rounded-lg border border-ink-200 overflow-hidden">
          <table className="dense w-full">
            <thead>
              <tr>
                <th>Name</th>
                <th>State</th>
                <th className="text-right">Received</th>
                <th className="text-right">Errors</th>
                <th className="text-right">Queued</th>
              </tr>
            </thead>
            <tbody>
              {channels.length === 0 && !error ? (
                <tr>
                  <td colSpan={5} className="text-center text-ink-600 py-8">
                    No channels found.
                  </td>
                </tr>
              ) : null}
              {channels
                .slice()
                .sort(
                  (a, b) =>
                    (b.statistics.queued || 0) - (a.statistics.queued || 0) ||
                    a.name.localeCompare(b.name)
                )
                .slice(0, 10)
                .map((c) => (
                  <tr key={c.id}>
                    <td>
                      <Link
                        href={`/channels/${c.id}`}
                        className="text-brand-500 hover:underline underline-offset-4 font-medium"
                      >
                        {c.name}
                      </Link>
                    </td>
                    <td>
                      <StateBadge state={c.state} />
                    </td>
                    <td className="text-right tabular-nums">
                      {c.statistics.received.toLocaleString()}
                    </td>
                    <td
                      className={`text-right tabular-nums ${c.statistics.errored > 0 ? "text-red-600 font-semibold" : ""}`}
                    >
                      {c.statistics.errored}
                    </td>
                    <td
                      className={`text-right tabular-nums ${
                        c.statistics.queued > 10
                          ? "text-red-600 font-semibold"
                          : c.statistics.queued > 0
                            ? "text-amber-700"
                            : ""
                      }`}
                    >
                      {c.statistics.queued}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
