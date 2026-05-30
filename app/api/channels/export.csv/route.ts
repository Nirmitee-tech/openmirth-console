import { getMirthClient } from "@/lib/mirth/client"
import { MirthError } from "@/lib/mirth/errors"
import { authorize, AuthError } from "@/lib/auth/authorize"
import { csvResponse, toCsv, type CsvColumn } from "@/lib/csv"
import { childLogger } from "@/lib/logger"
import type { ChannelWithStatus } from "@/lib/mirth/schemas"

const log = childLogger({ component: "channels-export" })

const COLUMNS: CsvColumn<ChannelWithStatus>[] = [
  { header: "Name", get: (c) => c.name },
  { header: "ID", get: (c) => c.id },
  { header: "Description", get: (c) => c.description },
  { header: "State", get: (c) => c.state },
  { header: "Revision", get: (c) => c.revision },
  { header: "Source", get: (c) => c.source.transportName },
  { header: "Destinations", get: (c) => c.destinations.map((d) => d.transportName).join("; ") },
  { header: "Destination Count", get: (c) => c.destinations.length },
  { header: "Received", get: (c) => c.statistics.received },
  { header: "Sent", get: (c) => c.statistics.sent },
  { header: "Filtered", get: (c) => c.statistics.filtered },
  { header: "Errored", get: (c) => c.statistics.errored },
  { header: "Queued", get: (c) => c.statistics.queued },
]

export async function GET(): Promise<Response> {
  try {
    await authorize("system:read", "channels-export")
  } catch (e) {
    const status = e instanceof AuthError ? e.status : 401
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status,
      headers: { "Content-Type": "application/json" },
    })
  }
  try {
    const channels = await getMirthClient().listChannelsWithStatus()
    const csv = toCsv(channels, COLUMNS)
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")
    return csvResponse(`channels-${stamp}.csv`, csv)
  } catch (e) {
    log.error({ err: (e as Error).message }, "export failed")
    return new Response(
      JSON.stringify({ error: e instanceof MirthError ? e.message : "Export failed" }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    )
  }
}
