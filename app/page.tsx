import Link from "next/link"
import { getMirthClient } from "@/lib/mirth/client"
import { MirthError } from "@/lib/mirth/errors"
import { StatCard } from "@/components/StatCard"
import { StateBadge } from "@/components/StateBadge"
import { Sparkline } from "@/components/Sparkline"
import { childLogger } from "@/lib/logger"
import { ensureSampler, getHistory } from "@/lib/timeseries"
import {
  classify,
  INTERFACE_BADGE_CLASS,
  INTERFACE_TYPES,
  type InterfaceType,
} from "@/lib/interface-classifier"
import type { ChannelWithStatus } from "@/lib/mirth/schemas"

const log = childLogger({ component: "dashboard-page" })

export const dynamic = "force-dynamic"

interface InterfaceBucket {
  type: InterfaceType
  impact: string
  channels: ChannelWithStatus[]
  totalReceived: number
  totalSent: number
  totalErrored: number
  totalQueued: number
  startedCount: number
}

export default async function Dashboard() {
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

  // Classify every channel; bucket by clinical interface type
  const buckets = new Map<InterfaceType, InterfaceBucket>()
  for (const c of channels) {
    const { type, impact } = classify(c.name)
    let b = buckets.get(type)
    if (!b) {
      b = {
        type,
        impact,
        channels: [],
        totalReceived: 0,
        totalSent: 0,
        totalErrored: 0,
        totalQueued: 0,
        startedCount: 0,
      }
      buckets.set(type, b)
    }
    b.channels.push(c)
    b.totalReceived += c.statistics.received
    b.totalSent += c.statistics.sent
    b.totalErrored += c.statistics.errored
    b.totalQueued += c.statistics.queued
    if (c.state === "STARTED") b.startedCount += 1
  }
  const orderedBuckets = INTERFACE_TYPES.map((t) => buckets.get(t)).filter(
    (b): b is InterfaceBucket => Boolean(b)
  )

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
            Live operational view of Mirth Connect{version ? ` ${version}` : ""} — grouped by
            clinical interface type so you can see workflow impact at a glance.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/channels"
            className="text-sm font-medium px-3 py-1.5 rounded border border-ink-200 bg-white hover:bg-ink-50 text-ink-900"
          >
            All channels →
          </Link>
          <Link
            href="/channels/new"
            className="bg-brand-500 hover:bg-brand-700 text-white text-sm font-medium px-3 py-1.5 rounded"
          >
            + New channel
          </Link>
        </div>
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

      {/* Clinical interface rollups — the most CIO-friendly view */}
      <section>
        <h2 className="text-lg font-semibold text-ink-900 mb-3">By clinical interface</h2>
        {orderedBuckets.length === 0 && !error ? (
          <div className="bg-white rounded-lg border border-ink-200 p-6 text-sm text-ink-600">
            No channels classified yet.
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {orderedBuckets.map((b) => (
              <InterfaceTile key={b.type} bucket={b} />
            ))}
          </div>
        )}
      </section>

      <section className="grid lg:grid-cols-2 gap-6">
        <Panel
          title={`Channels with errors (${errorChannels.length})`}
          empty="No channels are reporting errors. 🎉"
        >
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

        <Panel
          title={`Channels not running (${downChannels.length})`}
          empty="All channels are STARTED."
        >
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
        <h2 className="text-lg font-semibold text-ink-900 mb-3">
          Hottest channels (live throughput)
        </h2>
        <div className="bg-white rounded-lg border border-ink-200 overflow-hidden">
          <table className="dense w-full">
            <thead>
              <tr>
                <th>Channel</th>
                <th>Interface</th>
                <th>State</th>
                <th className="w-[180px]">Throughput (5m)</th>
                <th className="text-right">Received</th>
                <th className="text-right">Errors</th>
                <th className="text-right">Queued</th>
              </tr>
            </thead>
            <tbody>
              {channels
                .slice()
                .sort(
                  (a, b) =>
                    b.statistics.queued - a.statistics.queued ||
                    b.statistics.errored - a.statistics.errored ||
                    b.statistics.received - a.statistics.received
                )
                .slice(0, 10)
                .map((c) => {
                  const history = getHistory(c.id)
                  const { type } = classify(c.name)
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
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${INTERFACE_BADGE_CLASS[type]}`}
                        >
                          {type}
                        </span>
                      </td>
                      <td>
                        <StateBadge state={c.state} />
                      </td>
                      <td>
                        {history && history.rates.length > 1 ? (
                          <Sparkline
                            values={history.rates}
                            width={160}
                            height={28}
                            ariaLabel={`Throughput sparkline for ${c.name}`}
                          />
                        ) : (
                          <span className="text-xs text-ink-400 italic">collecting…</span>
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

function InterfaceTile({ bucket }: { bucket: InterfaceBucket }) {
  const issues =
    bucket.totalErrored > 0 ||
    bucket.totalQueued > 0 ||
    bucket.startedCount < bucket.channels.length
  return (
    <article
      className={`bg-white rounded-lg border-2 p-4 ${
        issues ? "border-amber-300" : "border-ink-200"
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <span
          className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${INTERFACE_BADGE_CLASS[bucket.type]}`}
        >
          {bucket.type}
        </span>
        <span className="text-xs text-ink-600">
          {bucket.startedCount} / {bucket.channels.length} STARTED
        </span>
      </div>
      <div className="text-xs text-ink-600 mb-3 min-h-[2.5rem]">{bucket.impact}</div>
      <div className="grid grid-cols-4 gap-2 text-xs">
        <Metric label="Recv" value={bucket.totalReceived.toLocaleString()} />
        <Metric label="Sent" value={bucket.totalSent.toLocaleString()} tone="good" />
        <Metric
          label="Err"
          value={bucket.totalErrored.toString()}
          tone={bucket.totalErrored > 0 ? "bad" : "neutral"}
        />
        <Metric
          label="Queue"
          value={bucket.totalQueued.toString()}
          tone={
            bucket.totalQueued > 10
              ? "bad"
              : bucket.totalQueued > 0
                ? "warn"
                : "neutral"
          }
        />
      </div>
      <details className="mt-3 text-xs">
        <summary className="cursor-pointer text-ink-600 hover:text-ink-900">
          {bucket.channels.length} channel{bucket.channels.length === 1 ? "" : "s"}
        </summary>
        <ul className="mt-2 space-y-1">
          {bucket.channels.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-2">
              <Link
                href={`/channels/${c.id}`}
                className="text-brand-500 hover:underline truncate"
              >
                {c.name}
              </Link>
              <StateBadge state={c.state} />
            </li>
          ))}
        </ul>
      </details>
    </article>
  )
}

function Metric({
  label,
  value,
  tone = "neutral",
}: {
  label: string
  value: string
  tone?: "neutral" | "good" | "warn" | "bad"
}) {
  const cls =
    tone === "good"
      ? "text-emerald-700"
      : tone === "warn"
        ? "text-amber-700"
        : tone === "bad"
          ? "text-red-700"
          : "text-ink-800"
  return (
    <div className="flex flex-col">
      <span className="text-[10px] uppercase tracking-wide text-ink-600">{label}</span>
      <span className={`font-mono font-semibold tabular-nums ${cls}`}>{value}</span>
    </div>
  )
}
