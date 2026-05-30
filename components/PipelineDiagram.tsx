/**
 * Pipeline diagram for a Mirth channel.
 *
 * Renders an inline SVG showing the message flow:
 *
 *   ┌──────────┐   ┌──────────┐   ┌───────────────┐    ┌─────────────┐
 *   │  SOURCE  │ → │  FILTER  │ → │  TRANSFORMER  │ ┬→ │ DESTINATION │
 *   └──────────┘   └──────────┘   └───────────────┘ │  └─────────────┘
 *                                                    │  ┌─────────────┐
 *                                                    └→ │ DESTINATION │
 *                                                       └─────────────┘
 *
 * Each stage is color-coded by health:
 *   - green = healthy (no errors, processing)
 *   - amber = warnings (some filtered/queued)
 *   - red   = errors (recent failures)
 *   - grey  = not configured / no traffic
 *
 * Below each stage we render the metric that's most informative for that
 * stage type — receive rate for source, filtered count for filters,
 * step count for transformers, queue depth + sent for destinations.
 */
import type { ChannelWithStatus } from "@/lib/mirth/schemas"

export interface PipelineDiagramProps {
  channel: ChannelWithStatus
  /** Aggregated per-stage failure counts derived from recent messages */
  failuresByConnector?: Record<number, number>
  /** Step counts pulled from the script editor parser */
  stepCounts?: {
    sourceFilter: number
    sourceTransformer: number
    destinations: Array<{
      metaDataId: number
      filter: number
      transformer: number
      response: number
    }>
  }
}

type Tone = "ok" | "warn" | "bad" | "idle"

const TONE_FILL: Record<Tone, string> = {
  ok:   "#dcfce7",  // emerald-100
  warn: "#fef3c7",  // amber-100
  bad:  "#fee2e2",  // red-100
  idle: "#f1f5f9",  // slate-100
}
const TONE_BORDER: Record<Tone, string> = {
  ok:   "#16a34a",
  warn: "#d97706",
  bad:  "#dc2626",
  idle: "#94a3b8",
}
const TONE_TEXT: Record<Tone, string> = {
  ok:   "#14532d",
  warn: "#92400e",
  bad:  "#7f1d1d",
  idle: "#475569",
}

function fmt(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`
}

export function PipelineDiagram({ channel, failuresByConnector = {}, stepCounts }: PipelineDiagramProps) {
  const sourceFailures = failuresByConnector[0] ?? 0
  const sourceTone: Tone =
    channel.state !== "STARTED"
      ? "idle"
      : sourceFailures > 0 || channel.statistics.errored > 0
        ? "bad"
        : channel.statistics.received > 0
          ? "ok"
          : "idle"

  const filterTone: Tone =
    channel.statistics.filtered > 0 ? "warn" : channel.statistics.received > 0 ? "ok" : "idle"
  const transformerTone: Tone =
    sourceFailures > 0 ? "bad" : channel.statistics.received > 0 ? "ok" : "idle"

  const destinations = channel.destinations.map((d, i) => {
    const metaDataId = i + 1
    const failed = failuresByConnector[metaDataId] ?? 0
    const dStepCounts = stepCounts?.destinations.find((sd) => sd.metaDataId === metaDataId)
    let tone: Tone = "idle"
    if (!d.enabled) tone = "idle"
    else if (failed > 0) tone = "bad"
    else if (channel.statistics.queued > 0) tone = "warn"
    else if (channel.statistics.sent > 0) tone = "ok"
    return { ...d, metaDataId, failed, tone, stepCounts: dStepCounts }
  })

  // Layout constants — laid out in CSS grid; the SVG arrows are decorative.
  // Vertical arrangement scales the same on mobile.

  return (
    <div className="bg-white rounded-lg border border-ink-200 p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-ink-900 uppercase tracking-wide">
          Message pipeline
        </h2>
        <div className="text-xs text-ink-600 flex items-center gap-3">
          <Legend tone="ok"   label="Healthy" />
          <Legend tone="warn" label="Warn" />
          <Legend tone="bad"  label="Errors" />
          <Legend tone="idle" label="Idle" />
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_24px_1fr_24px_1fr_24px_2fr] gap-y-3 items-stretch">
        {/* Source */}
        <Stage
          title="Source"
          subtitle={channel.source.transportName}
          tone={sourceTone}
          metrics={[
            ["Received", fmt(channel.statistics.received)],
            ["Errors",   fmt(channel.statistics.errored + sourceFailures)],
            channel.source.details.port
              ? ["Port", channel.source.details.port]
              : ["State", channel.state],
          ]}
        />
        <Arrow />

        {/* Source filter */}
        <Stage
          title="Source filter"
          subtitle={
            stepCounts && stepCounts.sourceFilter > 0
              ? `${stepCounts.sourceFilter} rule${stepCounts.sourceFilter === 1 ? "" : "s"}`
              : "no rules"
          }
          tone={filterTone}
          metrics={[
            ["Passed", fmt(channel.statistics.received - channel.statistics.filtered)],
            ["Filtered", fmt(channel.statistics.filtered)],
          ]}
        />
        <Arrow />

        {/* Source transformer */}
        <Stage
          title="Source transformer"
          subtitle={
            stepCounts && stepCounts.sourceTransformer > 0
              ? `${stepCounts.sourceTransformer} step${stepCounts.sourceTransformer === 1 ? "" : "s"}`
              : "no steps"
          }
          tone={transformerTone}
          metrics={[
            ["Transformed", fmt(channel.statistics.received - sourceFailures)],
            ["Failed", fmt(sourceFailures)],
          ]}
        />
        <Arrow fanOut={destinations.length > 1} />

        {/* Destinations */}
        <div className="space-y-2">
          {destinations.length === 0 ? (
            <div className="text-sm text-ink-600 italic px-3 py-2">No destinations configured.</div>
          ) : (
            destinations.map((d) => (
              <DestinationCard
                key={d.metaDataId}
                metaDataId={d.metaDataId}
                name={d.name}
                transport={d.transportName}
                tone={d.tone}
                enabled={d.enabled}
                failed={d.failed}
                stats={{
                  sent:   channel.statistics.sent,
                  queued: channel.statistics.queued,
                }}
                stepCounts={d.stepCounts}
                details={d.details}
              />
            ))
          )}
        </div>
      </div>
    </div>
  )
}

function Stage({
  title,
  subtitle,
  tone,
  metrics,
}: {
  title: string
  subtitle: string
  tone: Tone
  metrics: Array<[label: string, value: string]>
}) {
  return (
    <div
      className="rounded-lg p-3 border-2 flex flex-col min-h-[110px]"
      style={{
        backgroundColor: TONE_FILL[tone],
        borderColor: TONE_BORDER[tone],
        color: TONE_TEXT[tone],
      }}
    >
      <div className="text-[10px] uppercase tracking-wider font-semibold opacity-80">{title}</div>
      <div className="text-sm font-semibold leading-tight mt-0.5 truncate">{subtitle}</div>
      <div className="mt-auto pt-2 grid grid-cols-1 gap-0.5 text-xs">
        {metrics.map(([label, value]) => (
          <div key={label} className="flex items-baseline justify-between">
            <span className="opacity-70">{label}</span>
            <span className="font-mono font-semibold tabular-nums">{value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function DestinationCard({
  metaDataId,
  name,
  transport,
  tone,
  enabled,
  failed,
  stats,
  stepCounts,
  details,
}: {
  metaDataId: number
  name: string
  transport: string
  tone: Tone
  enabled: boolean
  failed: number
  stats: { sent: number; queued: number }
  stepCounts?: { metaDataId: number; filter: number; transformer: number; response: number }
  details: Record<string, string>
}) {
  const detailText =
    details.url ? `${details.method ?? "GET"} ${details.url}` :
    details.host ? `${details.host}${details.port ? ":" + details.port : ""}` :
    details.directory ? details.directory :
    details.targetChannelId ? `→ channel ${details.targetChannelId.slice(0, 8)}…` :
    transport

  return (
    <div
      className="rounded-lg p-3 border-2"
      style={{
        backgroundColor: TONE_FILL[tone],
        borderColor: TONE_BORDER[tone],
        color: TONE_TEXT[tone],
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-wider font-semibold opacity-80">
            Destination {metaDataId}
          </div>
          <div className="text-sm font-semibold leading-tight truncate">{name || transport}</div>
          <div className="text-xs opacity-70 truncate font-mono">{detailText}</div>
        </div>
        {!enabled ? (
          <span className="text-[10px] font-semibold uppercase tracking-wide bg-white/60 rounded px-1.5 py-0.5">
            Disabled
          </span>
        ) : null}
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
        <Metric label="Sent" value={fmt(stats.sent)} />
        <Metric label="Queued" value={fmt(stats.queued)} />
        <Metric label="Failed" value={fmt(failed)} />
      </div>
      {stepCounts ? (
        <div className="mt-1 flex items-center gap-2 text-[10px] opacity-70">
          <span>filter: {stepCounts.filter}</span>
          <span>·</span>
          <span>xform: {stepCounts.transformer}</span>
          <span>·</span>
          <span>resp: {stepCounts.response}</span>
        </div>
      ) : null}
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="opacity-70 text-[10px]">{label}</span>
      <span className="font-mono font-semibold tabular-nums">{value}</span>
    </div>
  )
}

function Legend({ tone, label }: { tone: Tone; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span
        className="inline-block w-3 h-3 rounded border-2"
        style={{
          backgroundColor: TONE_FILL[tone],
          borderColor: TONE_BORDER[tone],
        }}
      />
      {label}
    </span>
  )
}

function Arrow({ fanOut = false }: { fanOut?: boolean }) {
  return (
    <div className="hidden lg:flex items-center justify-center text-ink-400 text-xl select-none">
      {fanOut ? "⇒" : "→"}
    </div>
  )
}
