import Link from "next/link"
import { getMirthClient } from "@/lib/mirth/client"
import { MirthError } from "@/lib/mirth/errors"
import { childLogger } from "@/lib/logger"
import { getSession } from "@/lib/auth/session"
import { permit } from "@/lib/auth/roles"
import type { ChannelWithStatus } from "@/lib/mirth/schemas"
import { ChannelsTable } from "./channels-table"

const log = childLogger({ component: "channels-page" })

export const dynamic = "force-dynamic"

export default async function ChannelsPage() {
  let channels: ChannelWithStatus[] = []
  let error: string | null = null

  try {
    channels = await getMirthClient().listChannelsWithStatus()
  } catch (e) {
    log.error({ err: (e as Error).message }, "channels list fetch failed")
    error = e instanceof MirthError ? e.message : "Unexpected error loading channels"
  }

  const session = await getSession()
  const role = session.role ?? "viewer"
  const csrfToken = session.csrfToken ?? ""
  const canMutate = permit(role, "channel:start")

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink-900">Channels</h1>
          <p className="text-sm text-ink-600 mt-1">
            Search, filter, sort. Export to CSV for offline review.
          </p>
        </div>
        <Link
          href="/channels/new"
          className="bg-brand-500 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2 rounded"
        >
          + New channel
        </Link>
      </header>

      {error ? (
        <div className="rounded border border-red-200 bg-red-50 text-red-900 px-4 py-3 text-sm">
          {error}
        </div>
      ) : null}

      <ChannelsTable channels={channels} csrfToken={csrfToken} canMutate={canMutate} />
    </div>
  )
}
