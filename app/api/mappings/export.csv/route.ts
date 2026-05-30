import { getMirthClient } from "@/lib/mirth/client"
import { MirthError } from "@/lib/mirth/errors"
import { authorize, AuthError } from "@/lib/auth/authorize"
import { csvResponse, toCsv } from "@/lib/csv"

export async function GET(): Promise<Response> {
  try {
    await authorize("system:read", "mappings-export")
  } catch (e) {
    const status = e instanceof AuthError ? e.status : 401
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status,
      headers: { "Content-Type": "application/json" },
    })
  }
  try {
    const entries = await getMirthClient().getConfigurationMap()
    const rows = Object.entries(entries)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => ({ key, value }))
    const csv = toCsv(rows, [
      { header: "Key", get: (r) => r.key },
      { header: "Value", get: (r) => r.value },
    ])
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")
    return csvResponse(`mappings-${stamp}.csv`, csv)
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof MirthError ? e.message : "Export failed" }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    )
  }
}
