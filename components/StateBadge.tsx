import type { ChannelState } from "@/lib/mirth/schemas"

const classByState: Record<ChannelState, string> = {
  STARTED: "badge-started",
  STOPPED: "badge-stopped",
  PAUSED: "badge-paused",
  DEPLOYING: "badge-deploying",
  UNDEPLOYING: "badge-undeploying",
  UNKNOWN: "badge-unknown",
}

export function StateBadge({ state }: { state: ChannelState }) {
  return <span className={`badge ${classByState[state]}`}>{state}</span>
}
