import Link from "next/link"
import { getMirthClient } from "@/lib/mirth/client"
import { MirthError } from "@/lib/mirth/errors"
import { StateBadge } from "@/components/StateBadge"
import { childLogger } from "@/lib/logger"
import type { ChannelWithStatus } from "@/lib/mirth/schemas"

const log = childLogger({ component: "channels-page" })

export const dynamic = "force-dynamic"

export default async function ChannelsPage() {
  let channels: ChannelWithStatus[] = []
  let error: string | null = null

  try {
    channels = await getMirthClient().listChannelsWithStatus()
  } catch (e) {
    log.error({ err: (e as Error).message }, "channels list fetch failed")
    error =
      e instanceof MirthError ? e.message : "Unexpected error loading channels"
  }

  channels.sort(
    (a, b) =>
      (a.state !== "STARTED" ? 1 : 0) - (b.state !== "STARTED" ? 1 : 0) ||
      (b.statistics.queued || 0) - (a.statistics.queued || 0) ||
      a.name.localeCompare(b.name)
  )

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-ink-900">Channels</h1>
        <p className="text-sm text-ink-600 mt-1">
          Every channel known to Mirth — sorted by state, then by queue depth.
        </p>
      </header>

      {error ? (
        <div className="rounded border border-red-200 bg-red-50 text-red-900 px-4 py-3 text-sm">
          {error}
        </div>
      ) : null}

      <div className="bg-white rounded-lg border border-ink-200 overflow-hidden">
        <table className="dense w-full">
          <thead>
            <tr>
              <th>Name</th>
              <th>Source</th>
              <th>Destinations</th>
              <th>State</th>
              <th className="text-right">Received</th>
              <th className="text-right">Sent</th>
              <th className="text-right">Errors</th>
              <th className="text-right">Queued</th>
            </tr>
          </thead>
          <tbody>
            {channels.length === 0 && !error ? (
              <tr>
                <td colSpan={8} className="text-center text-ink-600 py-8">
                  No channels found.
                </td>
              </tr>
            ) : null}
            {channels.map((c) => (
              <tr key={c.id}>
                <td>
                  <Link
                    href={`/channels/${c.id}`}
                    className="text-brand-500 hover:underline underline-offset-4 font-medium"
                  >
                    {c.name}
                  </Link>
                  {c.description ? (
                    <div className="text-xs text-ink-600 mt-0.5 line-clamp-1">
                      {c.description}
                    </div>
                  ) : null}
                </td>
                <td className="text-xs">{c.source.transportName}</td>
                <td className="text-xs">
                  {c.destinations.map((d) => d.transportName).join(", ") || "—"}
                </td>
                <td>
                  <StateBadge state={c.state} />
                </td>
                <td className="text-right tabular-nums">
                  {c.statistics.received.toLocaleString()}
                </td>
                <td className="text-right tabular-nums">
                  {c.statistics.sent.toLocaleString()}
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
    </div>
  )
}
