import Link from "next/link"
import { getMirthClient } from "@/lib/mirth/client"
import { MirthError } from "@/lib/mirth/errors"
import { StatCard } from "@/components/StatCard"
import { StateBadge } from "@/components/StateBadge"
import { Sparkline } from "@/components/Sparkline"
import { childLogger } from "@/lib/logger"
import { ensureSampler, getHistory } from "@/lib/timeseries"
import type { ChannelWithStatus } from "@/lib/mirth/schemas"

const log = childLogger({ component: "dashboard-page" })

export const dynamic = "force-dynamic"

export default async function Dashboard() {
  // Ensure the throughput sampler is running (idempotent).
  ensureSampler()

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

  // Hottest channels for the live overview — sort by queue depth desc,
  // then by error count desc, then by rate.
  const hottest = channels
    .slice()
    .sort(
      (a, b) =>
        b.statistics.queued - a.statistics.queued ||
        b.statistics.errored - a.statistics.errored ||
        b.statistics.received - a.statistics.received
    )
    .slice(0, 8)

  const errorChannels = channels.filter((c) => c.statistics.errored > 0)
  const downChannels = channels.filter(
    (c) => c.state !== "STARTED" && c.state !== "PAUSED"
  )

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink-900">Dashboard</h1>
          <p className="text-sm text-ink-600 mt-1">
            Live view from Mirth Connect{version ? ` ${version}` : ""}. Sparklines show the
            last ~5 minutes of throughput, sampled every 10 seconds in-process.
          </p>
        </div>
        <Link
          href="/channels"
          className="text-sm font-medium px-3 py-1.5 rounded border border-ink-200 bg-white hover:bg-ink-50 text-ink-900"
        >
          All channels →
        </Link>
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

      <section className="grid lg:grid-cols-2 gap-6">
        <Panel title="Channels with errors" empty="No channels are reporting errors. 🎉">
          {errorChannels.length === 0 ? null : (
            <ul className="divide-y divide-ink-100">
              {errorChannels.slice(0, 8).map((c) => (
                <li key={c.id} className="py-2 flex items-center justify-between gap-3">
                  <Link
                    href={`/channels/${c.id}`}
                    className="text-sm font-medium text-brand-500 hover:underline underline-offset-4 truncate"
                  >
                    {c.name}
                  </Link>
                  <span className="text-xs text-red-700 font-semibold tabular-nums">
                    {c.statistics.errored} errored
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Channels not running" empty="All channels are STARTED.">
          {downChannels.length === 0 ? null : (
            <ul className="divide-y divide-ink-100">
              {downChannels.slice(0, 8).map((c) => (
                <li key={c.id} className="py-2 flex items-center justify-between gap-3">
                  <Link
                    href={`/channels/${c.id}`}
                    className="text-sm font-medium text-brand-500 hover:underline underline-offset-4 truncate"
                  >
                    {c.name}
                  </Link>
                  <StateBadge state={c.state} />
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-ink-900 mb-3">Hottest channels</h2>
        <div className="bg-white rounded-lg border border-ink-200 overflow-hidden">
          <table className="dense w-full">
            <thead>
              <tr>
                <th>Channel</th>
                <th>State</th>
                <th className="w-[160px]">Throughput (5m)</th>
                <th className="text-right">Received</th>
                <th className="text-right">Errors</th>
                <th className="text-right">Queued</th>
              </tr>
            </thead>
            <tbody>
              {hottest.length === 0 && !error ? (
                <tr>
                  <td colSpan={6} className="text-center text-ink-600 py-8">
                    No channels found.
                  </td>
                </tr>
              ) : null}
              {hottest.map((c) => {
                const history = getHistory(c.id)
                return (
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
                    <td>
                      {history && history.rates.length > 1 ? (
                        <Sparkline
                          values={history.rates}
                          width={140}
                          height={28}
                          ariaLabel={`Throughput sparkline for ${c.name}`}
                        />
                      ) : (
                        <span className="text-xs text-ink-400 italic">
                          collecting…
                        </span>
                      )}
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
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function Panel({
  title,
  children,
  empty,
}: {
  title: string
  children: React.ReactNode
  empty: string
}) {
  return (
    <div className="bg-white rounded-lg border border-ink-200 p-4">
      <h3 className="text-sm font-semibold text-ink-900 mb-2">{title}</h3>
      {children ?? <div className="text-sm text-ink-600">{empty}</div>}
    </div>
  )
}
