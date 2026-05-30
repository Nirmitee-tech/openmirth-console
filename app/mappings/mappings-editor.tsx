"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"

interface MappingsEditorProps {
  initial: Record<string, string>
  canEdit: boolean
  csrfToken: string
}

interface Row {
  key: string
  value: string
  // Track original key separately so renames work
  originalKey: string | null
  status: "unchanged" | "edited" | "new" | "deleted"
}

function rowsFromMap(map: Record<string, string>): Row[] {
  return Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => ({
      key,
      value,
      originalKey: key,
      status: "unchanged" as const,
    }))
}

function rowsToMap(rows: Row[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const r of rows) {
    if (r.status === "deleted") continue
    if (!r.key.trim()) continue
    out[r.key.trim()] = r.value
  }
  return out
}

export function MappingsEditor({ initial, canEdit, csrfToken }: MappingsEditorProps) {
  const router = useRouter()
  const [rows, setRows] = useState<Row[]>(() => rowsFromMap(initial))
  const [filter, setFilter] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [okMessage, setOkMessage] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(
      (r) =>
        r.key.toLowerCase().includes(q) ||
        r.value.toLowerCase().includes(q)
    )
  }, [rows, filter])

  const dirty = rows.some((r) => r.status !== "unchanged")
  const duplicateKeys = useMemo(() => {
    const seen = new Map<string, number>()
    const dupes = new Set<string>()
    for (const r of rows) {
      if (r.status === "deleted") continue
      const k = r.key.trim()
      if (!k) continue
      const n = (seen.get(k) ?? 0) + 1
      seen.set(k, n)
      if (n > 1) dupes.add(k)
    }
    return dupes
  }, [rows])

  function update(idx: number, patch: Partial<Row>) {
    setRows((prev) => {
      const next = [...prev]
      const row = { ...next[idx], ...patch }
      if (row.originalKey === null) {
        row.status = row.key || row.value ? "new" : "deleted"
      } else if (row.key === row.originalKey && row.value === (initial[row.originalKey] ?? "")) {
        row.status = "unchanged"
      } else {
        row.status = "edited"
      }
      next[idx] = row
      return next
    })
  }

  function remove(idx: number) {
    setRows((prev) => {
      const next = [...prev]
      const row = next[idx]
      next[idx] = row.originalKey === null
        ? { ...row, status: "deleted" }    // brand-new row → drop entirely
        : { ...row, status: "deleted" }
      return next
    })
  }

  function add() {
    setRows((prev) => [...prev, { key: "", value: "", originalKey: null, status: "new" }])
  }

  async function save() {
    setError(null)
    setOkMessage(null)
    if (duplicateKeys.size > 0) {
      setError(`Duplicate keys: ${Array.from(duplicateKeys).join(", ")}`)
      return
    }
    setSaving(true)
    try {
      const payload = rowsToMap(rows)
      const res = await fetch("/api/mappings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries: payload, csrfToken }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error ?? `Save failed (${res.status})`)
      }
      const body = await res.json()
      setOkMessage(`Saved ${body.count} mappings.`)
      // Reset row status to unchanged
      setRows(rowsFromMap(payload))
      router.refresh()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter by key or value..."
          className="rounded border border-ink-200 px-3 py-1.5 text-sm flex-1 min-w-[220px] focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        <a
          href="/api/mappings/export.csv"
          className="text-sm font-medium px-3 py-1.5 rounded border border-ink-200 bg-white hover:bg-ink-50 text-ink-900"
        >
          Export CSV
        </a>
        {canEdit ? (
          <>
            <button
              type="button"
              onClick={add}
              className="text-sm font-medium px-3 py-1.5 rounded border border-ink-200 bg-white hover:bg-ink-50 text-ink-900"
            >
              + Add mapping
            </button>
            <button
              type="button"
              onClick={save}
              disabled={!dirty || saving}
              className="text-sm font-medium px-3 py-1.5 rounded bg-brand-500 hover:bg-brand-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? "Saving…" : dirty ? "Save changes" : "Saved"}
            </button>
          </>
        ) : (
          <span className="text-xs text-ink-600">
            Read-only — admin role required to edit.
          </span>
        )}
      </div>

      {error ? (
        <div className="rounded border border-red-200 bg-red-50 text-red-900 px-3 py-2 text-sm">
          {error}
        </div>
      ) : null}
      {okMessage ? (
        <div className="rounded border border-emerald-200 bg-emerald-50 text-emerald-900 px-3 py-2 text-sm">
          {okMessage}
        </div>
      ) : null}

      <div className="bg-white rounded-lg border border-ink-200 overflow-hidden">
        <table className="dense w-full">
          <thead>
            <tr>
              <th className="w-[35%]">Key</th>
              <th>Value</th>
              <th className="w-[100px]">Status</th>
              {canEdit ? <th className="w-[60px]"></th> : null}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={canEdit ? 4 : 3} className="text-center text-ink-600 py-8">
                  No mappings found.
                </td>
              </tr>
            ) : null}
            {filtered.map((row) => {
              const idx = rows.indexOf(row)
              const isDup = duplicateKeys.has(row.key.trim())
              const rowClass =
                row.status === "deleted"
                  ? "opacity-40 line-through"
                  : row.status === "new"
                    ? "bg-emerald-50/50"
                    : row.status === "edited"
                      ? "bg-amber-50/50"
                      : ""
              return (
                <tr key={`${row.originalKey ?? "new"}-${idx}`} className={rowClass}>
                  <td>
                    <input
                      type="text"
                      value={row.key}
                      onChange={(e) => update(idx, { key: e.target.value })}
                      readOnly={!canEdit}
                      className={`w-full font-mono text-xs px-2 py-1 rounded border ${isDup ? "border-red-400 bg-red-50" : "border-ink-200"} ${!canEdit ? "bg-ink-50" : "bg-white"} focus:outline-none focus:ring-1 focus:ring-brand-500`}
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      value={row.value}
                      onChange={(e) => update(idx, { value: e.target.value })}
                      readOnly={!canEdit}
                      className={`w-full font-mono text-xs px-2 py-1 rounded border border-ink-200 ${!canEdit ? "bg-ink-50" : "bg-white"} focus:outline-none focus:ring-1 focus:ring-brand-500`}
                    />
                  </td>
                  <td className="text-xs uppercase tracking-wide text-ink-600">{row.status}</td>
                  {canEdit ? (
                    <td>
                      <button
                        type="button"
                        onClick={() => remove(idx)}
                        className="text-xs text-red-600 hover:text-red-800"
                        title="Mark for deletion"
                      >
                        Remove
                      </button>
                    </td>
                  ) : null}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
