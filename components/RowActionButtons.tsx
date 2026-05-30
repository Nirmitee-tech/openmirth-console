"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import type { ChannelState } from "@/lib/mirth/schemas"

interface RowActionButtonsProps {
  channelId: string
  state: ChannelState
  csrfToken: string
  canMutate: boolean
}

type QuickAction = "start" | "stop" | "pause" | "resume"

const ICON: Record<QuickAction, string> = {
  start:  "▶",
  stop:   "■",
  pause:  "❚❚",
  resume: "▶",
}

const TITLE: Record<QuickAction, string> = {
  start:  "Start channel",
  stop:   "Stop channel",
  pause:  "Pause channel",
  resume: "Resume channel",
}

const COLOR: Record<QuickAction, string> = {
  start:  "text-emerald-600 hover:text-emerald-800",
  stop:   "text-red-600 hover:text-red-800",
  pause:  "text-amber-600 hover:text-amber-800",
  resume: "text-emerald-600 hover:text-emerald-800",
}

function actionsForState(state: ChannelState): QuickAction[] {
  switch (state) {
    case "STARTED": return ["pause", "stop"]
    case "PAUSED":  return ["resume", "stop"]
    case "STOPPED": return ["start"]
    default:        return []
  }
}

export function RowActionButtons({ channelId, state, csrfToken, canMutate }: RowActionButtonsProps) {
  const router = useRouter()
  const [busy, setBusy] = useState<QuickAction | null>(null)

  async function run(action: QuickAction) {
    setBusy(action)
    try {
      const res = await fetch(`/api/channels/${encodeURIComponent(channelId)}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, csrfToken }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        alert(body.error ?? `Action failed (${res.status})`)
      } else {
        setTimeout(() => router.refresh(), 500)
      }
    } finally {
      setBusy(null)
    }
  }

  const actions = actionsForState(state)
  if (!canMutate || actions.length === 0) return null

  return (
    <div className="flex items-center gap-1">
      {actions.map((a) => (
        <button
          key={a}
          type="button"
          title={TITLE[a]}
          aria-label={TITLE[a]}
          disabled={busy !== null}
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            void run(a)
          }}
          className={`w-6 h-6 flex items-center justify-center rounded text-xs leading-none ${COLOR[a]} disabled:opacity-30 hover:bg-ink-100 dark:hover:bg-ink-800`}
        >
          {busy === a ? "…" : ICON[a]}
        </button>
      ))}
    </div>
  )
}
