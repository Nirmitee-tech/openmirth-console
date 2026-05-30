"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { StateBadge } from "@/components/StateBadge"
import { RowActionButtons } from "@/components/RowActionButtons"
import type { ChannelWithStatus } from "@/lib/mirth/schemas"

interface ChannelsTableProps {
  channels: ChannelWithStatus[]
  csrfToken: string
  canMutate: boolean
}

const STATE_OPTIONS = [
  "ALL",
  "STARTED",
  "STOPPED",
  "PAUSED",
  "DEPLOYING",
  "UNDEPLOYING",
  "UNKNOWN",
] as const

type SortKey =
  | "name"
  | "state"
  | "received"
  | "sent"
  | "errored"
  | "queued"
type SortDir = "asc" | "desc"

export function ChannelsTable({ channels, csrfToken, canMutate }: ChannelsTableProps) {
  const [search, setSearch] = useState("")
  const [stateFilter, setStateFilter] = useState<(typeof STATE_OPTIONS)[number]>("ALL")
  const [sortKey, setSortKey] = useState<SortKey>("queued")
  const [sortDir, setSortDir] = useState<SortDir>("desc")

  // Build the unique source/destination transport set for the source filter
  const sourceOptions = useMemo(() => {
    const set = new Set<string>()
    for (const c of channels) set.add(c.source.transportName)
    return ["ALL", ...Array.from(set).sort()]
  }, [channels])
  const [sourceFilter, setSourceFilter] = useState<string>("ALL")

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return channels.filter((c) => {
      if (stateFilter !== "ALL" && c.state !== stateFilter) return false
      if (sourceFilter !== "ALL" && c.source.transportName !== sourceFilter) return false
      if (!q) return true
      return (
        c.name.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q) ||
        c.destinations.some((d) =>
          (d.transportName + " " + d.name).toLowerCase().includes(q)
        )
      )
    })
  }, [channels, search, stateFilter, sourceFilter])

  const sorted = useMemo(() => {
    const copy = [...filtered]
    const dir = sortDir === "asc" ? 1 : -1
    copy.sort((a, b) => {
      const va = sortValue(a, sortKey)
      const vb = sortValue(b, sortKey)
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * dir
      return String(va).localeCompare(String(vb)) * dir
    })
    return copy
  }, [filtered, sortKey, sortDir])

  function setSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(key)
      setSortDir(key === "name" ? "asc" : "desc")
    }
  }

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-lg border border-ink-200 p-3 flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, ID, description, or destination..."
          className="rounded border border-ink-200 px-3 py-1.5 text-sm flex-1 min-w-[240px] focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        <select
          value={stateFilter}
          onChange={(e) => setStateFilter(e.target.value as (typeof STATE_OPTIONS)[number])}
          className="rounded border border-ink-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          {STATE_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s === "ALL" ? "All states" : s}
            </option>
          ))}
        </select>
        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
          className="rounded border border-ink-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          {sourceOptions.map((s) => (
            <option key={s} value={s}>
              {s === "ALL" ? "All source types" : s}
            </option>
          ))}
        </select>
        <span className="ml-auto text-sm text-ink-600">
          {sorted.length} of {channels.length}
        </span>
        <a
          href="/api/channels/export.csv"
          className="text-sm font-medium px-3 py-1.5 rounded border border-ink-200 bg-white hover:bg-ink-50 text-ink-900"
        >
          Export CSV
        </a>
      </div>

      <div className="bg-white rounded-lg border border-ink-200 overflow-hidden">
        <table className="dense w-full">
          <thead>
            <tr>
              <SortableTh label="Name" k="name" sortKey={sortKey} sortDir={sortDir} onClick={setSort} />
              <th>Source</th>
              <th>Destinations</th>
              <SortableTh label="State" k="state" sortKey={sortKey} sortDir={sortDir} onClick={setSort} />
              <SortableTh label="Received" k="received" sortKey={sortKey} sortDir={sortDir} onClick={setSort} align="right" />
              <SortableTh label="Sent" k="sent" sortKey={sortKey} sortDir={sortDir} onClick={setSort} align="right" />
              <SortableTh label="Errors" k="errored" sortKey={sortKey} sortDir={sortDir} onClick={setSort} align="right" />
              <SortableTh label="Queued" k="queued" sortKey={sortKey} sortDir={sortDir} onClick={setSort} align="right" />
              <th className="w-[80px]">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={9} className="text-center text-ink-600 py-8">
                  No channels match the current filters.
                </td>
              </tr>
            ) : null}
            {sorted.map((c) => (
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
                <td onClick={(e) => e.stopPropagation()}>
                  <RowActionButtons
                    channelId={c.id}
                    state={c.state}
                    csrfToken={csrfToken}
                    canMutate={canMutate}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function SortableTh({
  label,
  k,
  sortKey,
  sortDir,
  onClick,
  align = "left",
}: {
  label: string
  k: SortKey
  sortKey: SortKey
  sortDir: SortDir
  onClick: (k: SortKey) => void
  align?: "left" | "right"
}) {
  const active = sortKey === k
  return (
    <th className={align === "right" ? "text-right" : "text-left"}>
      <button
        type="button"
        onClick={() => onClick(k)}
        className={`inline-flex items-center gap-1 ${active ? "text-brand-500" : "hover:text-brand-500"}`}
      >
        {label}
        {active ? <span className="text-xs">{sortDir === "asc" ? "▲" : "▼"}</span> : null}
      </button>
    </th>
  )
}

function sortValue(c: ChannelWithStatus, key: SortKey): string | number {
  switch (key) {
    case "name":      return c.name.toLowerCase()
    case "state":     return c.state
    case "received":  return c.statistics.received
    case "sent":      return c.statistics.sent
    case "errored":   return c.statistics.errored
    case "queued":    return c.statistics.queued
  }
}
