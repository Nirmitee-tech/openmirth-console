import Link from "next/link"
import { notFound } from "next/navigation"
import { getMirthClient } from "@/lib/mirth/client"
import { MirthError } from "@/lib/mirth/errors"
import { StateBadge } from "@/components/StateBadge"
import { StatCard } from "@/components/StatCard"
import { Sparkline } from "@/components/Sparkline"
import { ChannelActions } from "@/components/ChannelActions"
import { PipelineDiagram } from "@/components/PipelineDiagram"
import { childLogger } from "@/lib/logger"
import { getSession } from "@/lib/auth/session"
import { permit } from "@/lib/auth/roles"
import { ensureSampler, getHistory } from "@/lib/timeseries"
import { parseMessages } from "@/lib/mirth/messages"
import { buildFailureBreakdown, failuresByConnector } from "@/lib/mirth/failure-analysis"
import { getChannelScripts } from "@/lib/mirth/scripts"

const log = childLogger({ component: "channel-detail-page" })

export const dynamic = "force-dynamic"

function formatTime(epoch: number | null): string {
  if (!epoch) return "—"
  return new Date(epoch).toISOString().replace("T", " ").slice(0, 19) + " UTC"
}

const STAGE_LABEL: Record<string, string> = {
  filter:    "Filter (rejected before transform)",
  transform: "Transformer (JavaScript error)",
  response:  "Response transformer (downstream returned, parse failed)",
  dispatch:  "Dispatch (HTTP/DB/file send failed)",
}

export default async function ChannelDetail({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  ensureSampler()

  let channel: Awaited<ReturnType<ReturnType<typeof getMirthClient>["getChannel"]>>
  let stepCounts: Awaited<ReturnType<typeof getChannelScripts>> | null = null
  let recentMessagesXml = ""

  try {
    const client = getMirthClient()
    const [c, sXml, mXml] = await Promise.all([
      client.getChannel(id),
      client.getChannelXml(id).catch(() => ""),
      client.listMessages(id, 100).catch(() => ""),
    ])
    channel = c
    if (sXml) stepCounts = getChannelScripts(sXml)
    recentMessagesXml = mXml
  } catch (e) {
    log.error({ err: (e as Error).message, channelId: id }, "channel detail fetch failed")
    return (
      <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
        {e instanceof MirthError ? e.message : "Unexpected error loading channel"}
      </div>
    )
  }
  if (!channel) notFound()

  const session = await getSession()
  const role = session.role ?? "viewer"
  const csrfToken = session.csrfToken ?? ""
  const canMutate = permit(role, "channel:start")
  const canDeploy = permit(role, "channel:deploy")

  const recentMessages = recentMessagesXml ? parseMessages(recentMessagesXml) : []
  const failures = buildFailureBreakdown(recentMessages)
  const failureMap = failuresByConnector(failures)

  const pipelineStepCounts = stepCounts
    ? {
        sourceFilter: stepCounts.source.filterRules.length,
        sourceTransformer: stepCounts.source.transformerSteps.length,
        destinations: stepCounts.destinations.map((d) => ({
          metaDataId: d.metaDataId,
          filter: d.filterRules.length,
          transformer: d.transformerSteps.length,
          response: d.responseTransformerSteps.length,
        })),
      }
    : undefined

  const history = getHistory(channel.id)

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <Link
            href="/channels"
            className="text-sm text-brand-500 hover:underline underline-offset-4"
          >
            ← All channels
          </Link>
          <h1 className="text-2xl font-semibold text-ink-900 dark:text-ink-100">{channel.name}</h1>
          {channel.description ? (
            <p className="text-sm text-ink-600 dark:text-ink-400 max-w-3xl">{channel.description}</p>
          ) : null}
          <div className="flex items-center gap-3 text-sm text-ink-600 dark:text-ink-400">
            <StateBadge state={channel.state} />
            <span>Revision {channel.revision}</span>
            <code className="text-xs bg-ink-100 dark:bg-ink-700 px-1.5 py-0.5 rounded">{channel.id}</code>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/channels/${channel.id}/scripts`}
            className="bg-brand-500 hover:bg-brand-700 text-white text-sm font-medium px-3 py-1.5 rounded"
          >
            Edit transformers &amp; filters →
          </Link>
          <Link
            href={`/channels/${channel.id}/messages`}
            className="text-sm font-medium px-3 py-1.5 rounded border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-800 hover:bg-ink-50 dark:hover:bg-ink-700 text-ink-900 dark:text-ink-100"
          >
            Browse messages →
          </Link>
        </div>
      </header>

      {/* Top-row stats */}
      <section className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <StatCard label="Received" value={channel.statistics.received.toLocaleString()} />
        <StatCard
          label="Sent"
          value={channel.statistics.sent.toLocaleString()}
          tone="good"
        />
        <StatCard label="Filtered" value={channel.statistics.filtered.toLocaleString()} />
        <StatCard
          label="Errors (lifetime)"
          value={channel.statistics.errored}
          tone={channel.statistics.errored > 0 ? "bad" : "neutral"}
        />
        <StatCard
          label="Queued"
          value={channel.statistics.queued}
          tone={
            channel.statistics.queued > 10
              ? "bad"
              : channel.statistics.queued > 0
                ? "warn"
                : "neutral"
          }
        />
        <StatCard
          label="Errors in last 100 msgs"
          value={failures.totalErrors}
          tone={failures.totalErrors > 0 ? "bad" : "neutral"}
        />
      </section>

      {/* Throughput sparkline */}
      {history && history.rates.length > 1 ? (
        <section className="bg-white dark:bg-ink-800 rounded-lg border border-ink-200 dark:border-ink-700 p-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-ink-900 dark:text-ink-100 uppercase tracking-wide">
              Throughput (last ~5 min, msg/s)
            </h2>
            <span className="text-xs text-ink-600 dark:text-ink-400">
              avg {(history.rates.reduce((a, b) => a + b, 0) / history.rates.length).toFixed(2)} ·
              {" "}peak {Math.max(...history.rates).toFixed(2)}
            </span>
          </div>
          <Sparkline values={history.rates} width={1200} height={48} />
        </section>
      ) : null}

      {/* Pipeline visualization — the headline panel */}
      <PipelineDiagram
        channel={channel}
        failuresByConnector={failureMap}
        stepCounts={pipelineStepCounts}
      />

      {/* Actions */}
      <section className="bg-white dark:bg-ink-800 rounded-lg border border-ink-200 dark:border-ink-700 p-4">
        <h2 className="text-sm font-semibold text-ink-900 dark:text-ink-100 uppercase tracking-wide mb-3">
          Lifecycle actions
        </h2>
        <ChannelActions
          channelId={channel.id}
          state={channel.state}
          csrfToken={csrfToken}
          canMutate={canMutate}
          canDeploy={canDeploy}
        />
      </section>

      {/* Failure breakdown */}
      <section>
        <h2 className="text-lg font-semibold text-ink-900 dark:text-ink-100 mb-3">
          Failures in the last {recentMessages.length} messages
        </h2>
        {failures.totalErrors === 0 && failures.totalQueued === 0 ? (
          <div className="bg-white dark:bg-ink-800 rounded-lg border border-ink-200 dark:border-ink-700 p-6 text-sm text-ink-600 dark:text-ink-400">
            No errors or queued messages in the recent window. 🎉
          </div>
        ) : (
          <div className="grid lg:grid-cols-2 gap-4">
            <div className="bg-white dark:bg-ink-800 rounded-lg border border-ink-200 dark:border-ink-700 overflow-hidden">
              <table className="dense w-full">
                <thead>
                  <tr>
                    <th>Connector</th>
                    <th>Likely stage</th>
                    <th className="text-right">Errors</th>
                    <th className="text-right">Queued</th>
                  </tr>
                </thead>
                <tbody>
                  {failures.byConnector.map((c) => (
                    <tr key={c.metaDataId}>
                      <td>
                        <div className="text-xs text-ink-600 dark:text-ink-400">
                          {c.metaDataId === 0 ? "Source" : `Destination ${c.metaDataId}`}
                        </div>
                        <div className="font-medium text-ink-900 dark:text-ink-100">{c.connectorName || "—"}</div>
                      </td>
                      <td className="text-xs text-ink-700 dark:text-ink-300">
                        {c.worstStage ? STAGE_LABEL[c.worstStage] : "—"}
                      </td>
                      <td
                        className={`text-right tabular-nums ${c.errorCount > 0 ? "text-red-600 font-semibold" : ""}`}
                      >
                        {c.errorCount}
                      </td>
                      <td
                        className={`text-right tabular-nums ${c.queuedCount > 0 ? "text-amber-700 font-semibold" : ""}`}
                      >
                        {c.queuedCount}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="bg-white dark:bg-ink-800 rounded-lg border border-ink-200 dark:border-ink-700 p-4 space-y-3">
              <h3 className="text-sm font-semibold text-ink-900 dark:text-ink-100">Recent errors</h3>
              {failures.recentErrors.length === 0 ? (
                <div className="text-sm text-ink-600 dark:text-ink-400 italic">
                  Only queue backlog, no hard errors.
                </div>
              ) : (
                <ul className="space-y-2">
                  {failures.recentErrors.slice(0, 5).map((e, i) => (
                    <li key={`${e.messageId}-${i}`} className="text-xs">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/channels/${channel.id}/messages`}
                          className="font-mono text-brand-500 hover:underline"
                        >
                          #{e.messageId}
                        </Link>
                        <span className="text-ink-600 dark:text-ink-400">{formatTime(e.receivedAt)}</span>
                        <span className="text-ink-700 dark:text-ink-300">— {e.connectorName}</span>
                      </div>
                      {e.excerpt ? (
                        <pre className="mt-1 bg-ink-900 text-ink-50 rounded px-2 py-1.5 font-mono overflow-x-auto whitespace-pre-wrap break-words">
                          {e.excerpt}
                        </pre>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
