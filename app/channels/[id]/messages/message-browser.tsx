"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import type { ConnectorPayload, ConnectorStatus, MirthMessage } from "@/lib/mirth/messages"

interface MessageBrowserProps {
  messages: MirthMessage[]
  channelId: string
  currentLimit: number
}

const STATUS_BADGES: Record<ConnectorStatus, string> = {
  SENT: "bg-emerald-100 text-emerald-800",
  TRANSFORMED: "bg-blue-100 text-blue-800",
  RECEIVED: "bg-blue-100 text-blue-800",
  FILTERED: "bg-amber-100 text-amber-900",
  QUEUED: "bg-amber-100 text-amber-900",
  PENDING: "bg-amber-100 text-amber-900",
  DELAYED: "bg-amber-100 text-amber-900",
  ERROR: "bg-red-100 text-red-800",
  UNKNOWN: "bg-ink-100 text-ink-600",
}

function formatTime(epoch: number): string {
  if (!epoch) return "—"
  return new Date(epoch).toISOString().replace("T", " ").slice(0, 19) + " UTC"
}

export function MessageBrowser({ messages, channelId, currentLimit }: MessageBrowserProps) {
  const router = useRouter()
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<"ALL" | ConnectorStatus>("ALL")
  const [expanded, setExpanded] = useState<string | null>(messages[0]?.messageId ?? null)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return messages.filter((m) => {
      if (statusFilter !== "ALL") {
        if (!m.connectors.some((c) => c.status === statusFilter)) return false
      }
      if (!q) return true
      if (m.messageId.includes(q)) return true
      return m.connectors.some((c) => {
        if (c.connectorName.toLowerCase().includes(q)) return true
        if (c.raw && c.raw.toLowerCase().includes(q)) return true
        if (c.transformed && c.transformed.toLowerCase().includes(q)) return true
        return false
      })
    })
  }, [messages, search, statusFilter])

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg border border-ink-200 p-3 flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search message id, connector name, or content..."
          className="rounded border border-ink-200 px-3 py-1.5 text-sm flex-1 min-w-[280px] focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as "ALL" | ConnectorStatus)}
          className="rounded border border-ink-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          <option value="ALL">All statuses</option>
          {(Object.keys(STATUS_BADGES) as ConnectorStatus[]).map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select
          value={currentLimit}
          onChange={(e) => router.push(`/channels/${channelId}/messages?limit=${e.target.value}`)}
          className="rounded border border-ink-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          title="Most-recent N messages to load"
        >
          {[10, 25, 50, 100, 200].map((n) => (
            <option key={n} value={n}>Last {n}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => router.refresh()}
          className="text-sm font-medium px-3 py-1.5 rounded border border-ink-200 bg-white hover:bg-ink-50 text-ink-900"
        >
          Refresh
        </button>
        <span className="ml-auto text-sm text-ink-600">
          {filtered.length} of {messages.length}
        </span>
      </div>

      {messages.length === 0 ? (
        <div className="bg-white rounded-lg border border-ink-200 p-8 text-center text-sm text-ink-600">
          No messages have been processed by this channel yet.
        </div>
      ) : null}

      <div className="space-y-2">
        {filtered.map((m) => {
          const isOpen = expanded === m.messageId
          const overallStatus = pickOverallStatus(m.connectors)
          return (
            <article key={m.messageId} className="bg-white rounded-lg border border-ink-200 overflow-hidden">
              <button
                type="button"
                onClick={() => setExpanded(isOpen ? null : m.messageId)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-ink-50"
              >
                <span className="text-xs font-mono text-ink-600 w-16">
                  #{m.messageId}
                </span>
                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_BADGES[overallStatus]}`}>
                  {overallStatus}
                </span>
                <span className="text-xs text-ink-600">{formatTime(m.receivedAt)}</span>
                <span className="text-xs text-ink-600">
                  {m.connectors.length} connector{m.connectors.length === 1 ? "" : "s"}
                </span>
                <span className="ml-auto text-ink-400 text-xs">
                  {isOpen ? "▲" : "▼"}
                </span>
              </button>
              {isOpen ? (
                <div className="border-t border-ink-200 divide-y divide-ink-100">
                  {m.connectors.map((c) => (
                    <ConnectorView key={c.metaDataId} connector={c} />
                  ))}
                </div>
              ) : null}
            </article>
          )
        })}
      </div>
    </div>
  )
}

function pickOverallStatus(connectors: ConnectorPayload[]): ConnectorStatus {
  if (connectors.some((c) => c.status === "ERROR")) return "ERROR"
  if (connectors.some((c) => c.status === "QUEUED")) return "QUEUED"
  if (connectors.some((c) => c.status === "FILTERED")) return "FILTERED"
  if (connectors.every((c) => c.status === "SENT")) return "SENT"
  const source = connectors.find((c) => c.metaDataId === 0)
  return source?.status ?? connectors[0]?.status ?? "UNKNOWN"
}

function ConnectorView({ connector }: { connector: ConnectorPayload }) {
  const [tab, setTab] = useState<"raw" | "transformed" | "encoded" | "response">("raw")
  const labels: Array<[typeof tab, string, string | null]> = [
    ["raw", "Raw", connector.raw],
    ["transformed", "Transformed", connector.transformed],
    ["encoded", "Encoded", connector.encoded],
    ["response", "Response", connector.response],
  ]
  const available = labels.filter(([, , v]) => v !== null)
  const active = available.find(([id]) => id === tab) ?? available[0]

  return (
    <div className="px-4 py-3 space-y-2">
      <div className="flex items-center gap-3">
        <span className="text-xs text-ink-600">
          {connector.metaDataId === 0 ? "Source" : `Destination ${connector.metaDataId}`}
        </span>
        <span className="text-sm font-medium text-ink-900">{connector.connectorName || "—"}</span>
        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_BADGES[connector.status]}`}>
          {connector.status}
        </span>
        {connector.truncated ? (
          <span className="text-xs text-amber-700">payload truncated for display</span>
        ) : null}
      </div>
      {available.length === 0 ? (
        <div className="text-xs text-ink-600 italic">No payload content recorded.</div>
      ) : (
        <>
          <div className="flex gap-1">
            {available.map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`text-xs px-2 py-1 rounded ${
                  active && active[0] === id
                    ? "bg-brand-500 text-white"
                    : "bg-ink-100 text-ink-700 hover:bg-ink-200"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <pre className="bg-ink-900 text-ink-50 text-xs font-mono p-3 rounded overflow-x-auto max-h-96 overflow-y-auto whitespace-pre-wrap break-words">
            {active ? active[2] : ""}
          </pre>
        </>
      )}
    </div>
  )
}
