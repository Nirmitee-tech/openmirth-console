import Link from "next/link"
import { notFound } from "next/navigation"
import { getMirthClient } from "@/lib/mirth/client"
import { MirthError } from "@/lib/mirth/errors"
import { StateBadge } from "@/components/StateBadge"
import { StatCard } from "@/components/StatCard"
import { ChannelActions } from "@/components/ChannelActions"
import { childLogger } from "@/lib/logger"
import { getSession } from "@/lib/auth/session"
import { permit } from "@/lib/auth/roles"

const log = childLogger({ component: "channel-detail-page" })

export const dynamic = "force-dynamic"

export default async function ChannelDetail({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  let channel: Awaited<ReturnType<ReturnType<typeof getMirthClient>["getChannel"]>>
  try {
    channel = await getMirthClient().getChannel(id)
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

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <Link
          href="/channels"
          className="text-sm text-brand-500 hover:underline underline-offset-4"
        >
          ← All channels
        </Link>
        <h1 className="text-2xl font-semibold text-ink-900">{channel.name}</h1>
        {channel.description ? (
          <p className="text-sm text-ink-600">{channel.description}</p>
        ) : null}
        <div className="flex items-center gap-3 text-sm text-ink-600">
          <StateBadge state={channel.state} />
          <span>Revision {channel.revision}</span>
          <code className="text-xs bg-ink-100 px-1.5 py-0.5 rounded">{channel.id}</code>
        </div>
      </header>

      <section className="bg-white rounded-lg border border-ink-200 p-4">
        <h2 className="text-sm font-semibold text-ink-900 uppercase tracking-wide mb-3">
          Actions
        </h2>
        <ChannelActions
          channelId={channel.id}
          state={channel.state}
          csrfToken={csrfToken}
          canMutate={canMutate}
          canDeploy={canDeploy}
        />
        <div className="mt-4 pt-4 border-t border-ink-100 flex flex-wrap gap-2">
          <Link
            href={`/channels/${channel.id}/scripts`}
            className="text-sm font-medium px-3 py-1.5 rounded border border-ink-200 bg-white hover:bg-ink-50 text-ink-900"
          >
            Edit transformers &amp; filters →
          </Link>
          <Link
            href={`/channels/${channel.id}/messages`}
            className="text-sm font-medium px-3 py-1.5 rounded border border-ink-200 bg-white hover:bg-ink-50 text-ink-900"
          >
            Browse messages →
          </Link>
        </div>
      </section>

      <section className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard label="Received" value={channel.statistics.received.toLocaleString()} />
        <StatCard
          label="Sent"
          value={channel.statistics.sent.toLocaleString()}
          tone="good"
        />
        <StatCard label="Filtered" value={channel.statistics.filtered.toLocaleString()} />
        <StatCard
          label="Errors"
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
      </section>

      <section>
        <h2 className="text-lg font-semibold text-ink-900 mb-3">Message flow</h2>
        <div className="space-y-3">
          <FlowNode
            kind="source"
            title="Source"
            name={channel.source.transportName}
            details={channel.source.details}
            enabled={channel.source.enabled}
          />
          {channel.destinations.length === 0 ? (
            <div className="text-sm text-ink-600 italic">No destinations configured.</div>
          ) : (
            channel.destinations.map((d, i) => (
              <div key={`${d.name}-${i}`} className="flex flex-col gap-1">
                <div className="text-center text-ink-400 text-xl leading-none">↓</div>
                <FlowNode
                  kind="dest"
                  title={`Destination ${i + 1}: ${d.name}`}
                  name={d.transportName}
                  details={d.details}
                  enabled={d.enabled}
                />
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  )
}

function FlowNode({
  kind,
  title,
  name,
  details,
  enabled,
}: {
  kind: "source" | "dest"
  title: string
  name: string
  details: Record<string, string>
  enabled: boolean
}) {
  const accent = kind === "source" ? "border-l-accent-amber" : "border-l-brand-500"
  return (
    <div className={`bg-white rounded border border-ink-200 border-l-4 ${accent} p-4`}>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-wide text-ink-600">{title}</div>
          <div className="text-base font-semibold text-ink-900">{name}</div>
        </div>
        {!enabled ? <span className="badge badge-stopped">DISABLED</span> : null}
      </div>
      {Object.keys(details).length > 0 ? (
        <dl className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-1 text-sm">
          {Object.entries(details).map(([k, v]) => (
            <div key={k} className="flex gap-2">
              <dt className="text-ink-600">{k}:</dt>
              <dd className="text-ink-800 font-mono text-xs truncate">{v}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  )
}
