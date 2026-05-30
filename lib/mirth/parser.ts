import { XMLParser } from "fast-xml-parser"
import {
  ChannelSchema,
  ChannelStateSchema,
  ChannelStatisticsSchema,
  DashboardStatusSchema,
  type Channel,
  type ChannelStatistics,
  type DashboardStatus,
} from "./schemas"
import { MirthSchemaError } from "./errors"

/**
 * Mirth XML → typed objects.
 *
 * Mirth serializes everything via XStream, which produces XML that's
 * idiosyncratic in ways the official docs don't cover. We do the
 * parsing once here so every consumer gets validated, typed shapes.
 */
const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  parseTagValue: true,
  parseAttributeValue: true,
  trimValues: true,
  allowBooleanAttributes: true,
  // Some Mirth fields appear once or as arrays depending on count.
  // Always coerce these to arrays so downstream code doesn't branch.
  isArray: (tag) =>
    [
      "dashboardStatus",
      "channel",
      "connector",
      "entry",
    ].includes(tag),
})

interface RawEntry {
  // <entry><com.mirth.connect.donkey.model.message.Status>RECEIVED</...><long>123</long></entry>
  // The key is the first non-text child; the value is the second.
  [k: string]: unknown
}

function extractStatistics(statsNode: unknown): ChannelStatistics {
  const empty = ChannelStatisticsSchema.parse({})
  if (!statsNode || typeof statsNode !== "object") return empty

  const entryField = (statsNode as { entry?: unknown }).entry
  const entries: RawEntry[] = Array.isArray(entryField) ? (entryField as RawEntry[]) : []

  const mapping: Record<string, keyof ChannelStatistics> = {
    RECEIVED: "received",
    SENT: "sent",
    FILTERED: "filtered",
    ERROR: "errored",
    QUEUED: "queued",
  }

  const stats: Partial<ChannelStatistics> = {}
  for (const entry of entries) {
    // XStream renders {Status: "RECEIVED", long: 123}
    let key: string | undefined
    let value: number | undefined
    for (const [k, v] of Object.entries(entry)) {
      if (k.startsWith("@_")) continue
      if (typeof v === "string" && k.includes("Status")) key = v
      if (typeof v === "string" && !key) key = v // fallback when type info dropped
      if (typeof v === "number" && k === "long") value = v
      if (typeof v === "number" && value === undefined) value = v
    }
    if (key && mapping[key] !== undefined && typeof value === "number") {
      stats[mapping[key]] = value
    }
  }

  return ChannelStatisticsSchema.parse({ ...empty, ...stats })
}

export function parseStatuses(xml: string): DashboardStatus[] {
  let parsed: unknown
  try {
    parsed = xmlParser.parse(xml)
  } catch (e) {
    throw new MirthSchemaError("Failed to parse statuses XML", e, e)
  }

  const root = (parsed as { list?: { dashboardStatus?: unknown } })?.list
  if (!root) return []

  const raw = Array.isArray(root.dashboardStatus)
    ? (root.dashboardStatus as Record<string, unknown>[])
    : []
  const results: DashboardStatus[] = []

  for (const ds of raw) {
    const candidate = {
      channelId: typeof ds.channelId === "string" ? ds.channelId : "",
      name: typeof ds.name === "string" ? ds.name : "",
      state: typeof ds.state === "string" ? ds.state : "UNKNOWN",
      statistics: extractStatistics(ds.statistics),
      queueEnabled: typeof ds.queueEnabled === "boolean" ? ds.queueEnabled : undefined,
    }

    const validated = DashboardStatusSchema.safeParse(candidate)
    if (validated.success) {
      results.push(validated.data)
    } else {
      // Skip unparseable rows but never silently — caller can choose to
      // surface this via the logger.
      throw new MirthSchemaError(
        `Invalid dashboard status for channel "${candidate.name || candidate.channelId}"`,
        validated.error.issues
      )
    }
  }

  return results
}

interface RawConnector {
  name?: string
  transportName?: string
  enabled?: boolean | string
  mode?: string
  properties?: {
    "@_class"?: string
    listenerConnectorProperties?: { host?: string; port?: string | number }
    host?: string
    remoteAddress?: string
    remotePort?: string | number
    url?: string
    method?: string
    directory?: string
    driver?: string
    channelId?: string
    outputPattern?: string
  }
}

function extractConnectorDetails(props: RawConnector["properties"]): Record<string, string> {
  if (!props) return {}
  const details: Record<string, string> = {}
  const cls = props["@_class"] ?? ""

  if (cls.includes("tcp.Tcp")) {
    if (props.listenerConnectorProperties?.port !== undefined) {
      details.port = String(props.listenerConnectorProperties.port)
    }
    if (props.listenerConnectorProperties?.host) {
      details.host = String(props.listenerConnectorProperties.host)
    }
    if (props.remoteAddress) details.remoteHost = String(props.remoteAddress)
    if (props.remotePort !== undefined) details.remotePort = String(props.remotePort)
  }
  if (cls.includes("http.Http")) {
    if (props.url) details.url = String(props.url)
    if (props.method) details.method = String(props.method).toUpperCase()
  }
  if (cls.includes("file.File")) {
    if (props.directory) details.directory = String(props.directory)
    if (props.outputPattern) details.pattern = String(props.outputPattern)
  }
  if (cls.includes("jdbc.Database")) {
    if (props.driver) details.driver = String(props.driver)
    if (props.url) details.url = String(props.url)
  }
  if (cls.includes("vm.Vm") && props.channelId) {
    details.targetChannelId = String(props.channelId)
  }

  return details
}

function parseConnector(raw: RawConnector): Channel["source"] {
  return {
    name: raw.name ?? "(unnamed)",
    transportName: raw.transportName ?? "Unknown",
    enabled: raw.enabled === undefined ? true : raw.enabled === true || raw.enabled === "true",
    details: extractConnectorDetails(raw.properties),
  }
}

export function parseChannels(xml: string): Channel[] {
  let parsed: unknown
  try {
    parsed = xmlParser.parse(xml)
  } catch (e) {
    throw new MirthSchemaError("Failed to parse channels XML", e, e)
  }

  const root = (parsed as { list?: { channel?: unknown } })?.list
  if (!root) return []

  const raw = Array.isArray(root.channel)
    ? (root.channel as Record<string, unknown>[])
    : []
  const channels: Channel[] = []

  for (const ch of raw) {
    const destRoot = ch.destinationConnectors as { connector?: unknown } | undefined
    const destList = Array.isArray(destRoot?.connector)
      ? (destRoot.connector as RawConnector[])
      : []
    const candidate = {
      id: typeof ch.id === "string" ? ch.id : "",
      name: typeof ch.name === "string" ? ch.name : "(unnamed)",
      description: typeof ch.description === "string" ? ch.description : "",
      revision: ch.revision !== undefined ? String(ch.revision) : "0",
      source: parseConnector((ch.sourceConnector ?? {}) as RawConnector),
      destinations: destList.map(parseConnector),
    }

    const validated = ChannelSchema.safeParse(candidate)
    if (validated.success) {
      channels.push(validated.data)
    } else {
      throw new MirthSchemaError(
        `Invalid channel "${candidate.name}"`,
        validated.error.issues
      )
    }
  }

  return channels
}

/**
 * Mirth Configuration Map XML <-> Record<string,string>.
 *
 * The map is a server-level key/value lookup channels can reference via
 * configurationMap.get('foo'). Mirth stores values as ConfigurationProperty
 * elements with optional comments — we drop the comments on read for now;
 * round-tripping comments is a Phase 2 feature.
 *
 * Shape:
 *   <map>
 *     <entry>
 *       <string>FACILITY_NPI</string>
 *       <com.mirth.connect.util.ConfigurationProperty>
 *         <value>1234567890</value>
 *         <comment>NPI for the main facility</comment>
 *       </com.mirth.connect.util.ConfigurationProperty>
 *     </entry>
 *   </map>
 */
export function parseConfigurationMap(xml: string): Record<string, string> {
  let parsed: unknown
  try {
    parsed = xmlParser.parse(xml)
  } catch (e) {
    throw new MirthSchemaError("Failed to parse configurationMap XML", e, e)
  }
  const root = (parsed as { map?: { entry?: unknown } })?.map
  if (!root) return {}
  const entries = Array.isArray(root.entry) ? root.entry : []
  const out: Record<string, string> = {}
  for (const e of entries as Array<Record<string, unknown>>) {
    const key = typeof e.string === "string" ? e.string : null
    if (!key) continue
    const prop = e["com.mirth.connect.util.ConfigurationProperty"] as
      | { value?: unknown }
      | undefined
    const value =
      typeof prop?.value === "string"
        ? prop.value
        : prop?.value !== undefined
          ? String(prop.value)
          : ""
    out[key] = value
  }
  return out
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

export function serializeConfigurationMap(entries: Record<string, string>): string {
  const body = Object.entries(entries)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(
      ([k, v]) =>
        `  <entry>\n` +
        `    <string>${escapeXml(k)}</string>\n` +
        `    <com.mirth.connect.util.ConfigurationProperty>\n` +
        `      <value>${escapeXml(v)}</value>\n` +
        `      <comment></comment>\n` +
        `    </com.mirth.connect.util.ConfigurationProperty>\n` +
        `  </entry>`
    )
    .join("\n")
  return `<map>\n${body}\n</map>\n`
}

/**
 * Channel metadata merge — preserve every existing entry and add/update
 * the one we care about. Mirth's PUT /api/server/channelMetadata fully
 * REPLACES the stored map, so naively sending a single-entry map wipes
 * the enabled flag and pruning settings for every other channel.
 *
 * We parse the existing XML, mutate the target entry (or append a new
 * one with sane defaults), and re-serialize. Other entries are
 * passed through structurally unchanged.
 */
interface ChannelMetadataEntry {
  channelId: string
  enabled: boolean
  pruneMetaDataDays: number
  pruneContentDays: number
  archiveEnabled: boolean
  lastModifiedTime: string
  lastModifiedTimezone: string
}

function parseChannelMetadataMap(xml: string): ChannelMetadataEntry[] {
  let parsed: unknown
  try {
    parsed = xmlParser.parse(xml)
  } catch (e) {
    throw new MirthSchemaError("Failed to parse channelMetadata XML", e, e)
  }
  const root = (parsed as { map?: { entry?: unknown } })?.map
  if (!root) return []
  const entries = Array.isArray(root.entry) ? root.entry : []
  const out: ChannelMetadataEntry[] = []
  for (const e of entries as Array<Record<string, unknown>>) {
    const channelId = typeof e.string === "string" ? e.string : null
    if (!channelId) continue
    const meta = e["com.mirth.connect.model.ChannelMetadata"] as
      | Record<string, unknown>
      | undefined
    if (!meta) continue
    const pruning = meta.pruningSettings as Record<string, unknown> | undefined
    const lastModified = meta.lastModified as Record<string, unknown> | undefined
    out.push({
      channelId,
      enabled: meta.enabled === true || meta.enabled === "true",
      pruneMetaDataDays:
        typeof pruning?.pruneMetaDataDays === "number"
          ? pruning.pruneMetaDataDays
          : Number(pruning?.pruneMetaDataDays ?? 30),
      pruneContentDays:
        typeof pruning?.pruneContentDays === "number"
          ? pruning.pruneContentDays
          : Number(pruning?.pruneContentDays ?? 30),
      archiveEnabled: pruning?.archiveEnabled === true || pruning?.archiveEnabled === "true",
      lastModifiedTime: String(lastModified?.time ?? "0"),
      lastModifiedTimezone: String(lastModified?.timezone ?? "UTC"),
    })
  }
  return out
}

function serializeChannelMetadataMap(entries: ChannelMetadataEntry[]): string {
  const body = entries
    .map(
      (e) =>
        `  <entry>\n` +
        `    <string>${e.channelId}</string>\n` +
        `    <com.mirth.connect.model.ChannelMetadata>\n` +
        `      <enabled>${e.enabled ? "true" : "false"}</enabled>\n` +
        `      <lastModified>\n` +
        `        <time>${e.lastModifiedTime}</time>\n` +
        `        <timezone>${e.lastModifiedTimezone}</timezone>\n` +
        `      </lastModified>\n` +
        `      <pruningSettings>\n` +
        `        <pruneMetaDataDays>${e.pruneMetaDataDays}</pruneMetaDataDays>\n` +
        `        <pruneContentDays>${e.pruneContentDays}</pruneContentDays>\n` +
        `        <archiveEnabled>${e.archiveEnabled ? "true" : "false"}</archiveEnabled>\n` +
        `      </pruningSettings>\n` +
        `    </com.mirth.connect.model.ChannelMetadata>\n` +
        `  </entry>`
    )
    .join("\n")
  return `<map>\n${body}\n</map>\n`
}

export function mergeChannelMetadata(
  currentXml: string,
  channelId: string,
  enabled: boolean
): string {
  const entries = parseChannelMetadataMap(currentXml)
  const existing = entries.find((e) => e.channelId === channelId)
  if (existing) {
    existing.enabled = enabled
  } else {
    entries.push({
      channelId,
      enabled,
      pruneMetaDataDays: 30,
      pruneContentDays: 30,
      archiveEnabled: false,
      lastModifiedTime: "0",
      lastModifiedTimezone: "UTC",
    })
  }
  return serializeChannelMetadataMap(entries)
}

/** Exposed for unit testing of the state parser */
export const _internal = { ChannelStateSchema, extractStatistics }
