"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import type { ChannelState } from "@/lib/mirth/schemas"

interface ChannelActionsProps {
  channelId: string
  state: ChannelState
  csrfToken: string
  canMutate: boolean // role >= operator
  canDeploy: boolean // role >= operator
}

type Action = "start" | "stop" | "pause" | "resume" | "halt" | "deploy" | "undeploy"

const LABELS: Record<Action, string> = {
  start: "Start",
  stop: "Stop",
  pause: "Pause",
  resume: "Resume",
  halt: "Halt",
  deploy: "Deploy",
  undeploy: "Undeploy",
}

const VARIANTS: Record<Action, string> = {
  start: "bg-emerald-600 hover:bg-emerald-700 text-white",
  resume: "bg-emerald-600 hover:bg-emerald-700 text-white",
  stop: "bg-red-600 hover:bg-red-700 text-white",
  halt: "bg-red-700 hover:bg-red-800 text-white",
  pause: "bg-amber-600 hover:bg-amber-700 text-white",
  deploy: "bg-brand-500 hover:bg-brand-700 text-white",
  undeploy: "bg-ink-600 hover:bg-ink-800 text-white",
}

function actionsForState(state: ChannelState): Action[] {
  switch (state) {
    case "STARTED":     return ["pause", "stop", "halt"]
    case "PAUSED":      return ["resume", "stop", "halt"]
    case "STOPPED":     return ["start", "deploy", "undeploy"]
    case "DEPLOYING":   return []
    case "UNDEPLOYING": return []
    case "UNKNOWN":     return ["deploy"]
    default:            return ["deploy"]
  }
}

export function ChannelActions({ channelId, state, csrfToken, canMutate, canDeploy }: ChannelActionsProps) {
  const router = useRouter()
  const [busy, setBusy] = useState<Action | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [okMessage, setOkMessage] = useState<string | null>(null)

  const allowed = (a: Action): boolean =>
    a === "deploy" || a === "undeploy" ? canDeploy : canMutate

  async function run(action: Action) {
    if (!confirm(`${LABELS[action]} this channel?`)) return
    setBusy(action)
    setError(null)
    setOkMessage(null)
    try {
      const res = await fetch(`/api/channels/${encodeURIComponent(channelId)}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, csrfToken }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error ?? `Action failed (${res.status})`)
      }
      setOkMessage(`${LABELS[action]} sent.`)
      // Give Mirth a moment to transition state, then refresh server data
      setTimeout(() => router.refresh(), 800)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  const actions = actionsForState(state)

  if (actions.length === 0) {
    return (
      <div className="text-sm text-ink-600 italic">
        Channel is transitioning ({state}); actions paused.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {actions.map((action) => {
          const ok = allowed(action)
          return (
            <button
              key={action}
              onClick={() => run(action)}
              disabled={!ok || busy !== null}
              title={ok ? "" : "Your role does not permit this action"}
              className={`text-sm font-medium px-3 py-1.5 rounded disabled:opacity-50 disabled:cursor-not-allowed ${VARIANTS[action]}`}
            >
              {busy === action ? "…" : LABELS[action]}
            </button>
          )
        })}
      </div>
      {error ? (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
          {error}
        </div>
      ) : null}
      {okMessage ? (
        <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-3 py-2">
          {okMessage}
        </div>
      ) : null}
    </div>
  )
}
