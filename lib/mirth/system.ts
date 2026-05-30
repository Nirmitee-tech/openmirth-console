/**
 * Parsers for Mirth's /api/system/info, /api/system/stats, /api/events,
 * and /api/channelgroups responses.
 *
 * These are small enough that hand-written regex extraction is more
 * reliable than full DOM parsing — Mirth's XStream output is strict
 * about field ordering and we just need a few values.
 */

export interface SystemInfo {
  jvmVersion: string
  osName: string
  osVersion: string
  osArchitecture: string
  dbName: string
  dbVersion: string
}

export interface SystemStats {
  timestamp: number       // epoch ms
  cpuUsagePct: number     // 0..100
  allocatedMemoryBytes: number
  freeMemoryBytes: number
  maxMemoryBytes: number
  diskFreeBytes: number
  diskTotalBytes: number
}

export type EventLevel = "INFORMATION" | "WARNING" | "ERROR" | "DEBUG" | "TRACE"
export type EventOutcome = "SUCCESS" | "FAILURE" | "UNKNOWN"

export interface ServerEvent {
  id: string
  /** Epoch ms of the actual event (eventTime, NOT the record timestamp) */
  eventTime: number
  level: EventLevel
  name: string
  outcome: EventOutcome
  userId: string
  ipAddress: string
  /** Free-form attribute map */
  attributes: Record<string, string>
}

export interface ChannelGroup {
  id: string
  name: string
  description: string
  /** Member channel IDs in declared order */
  channelIds: string[]
}

function pick(xml: string, tag: string): string {
  const m = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`).exec(xml)
  return m ? m[1].trim() : ""
}

function num(xml: string, tag: string): number {
  const v = pick(xml, tag)
  const n = parseFloat(v)
  return Number.isFinite(n) ? n : 0
}

export function parseSystemInfo(xml: string): SystemInfo {
  return {
    jvmVersion:     pick(xml, "jvmVersion"),
    osName:         pick(xml, "osName"),
    osVersion:      pick(xml, "osVersion"),
    osArchitecture: pick(xml, "osArchitecture"),
    dbName:         pick(xml, "dbName"),
    dbVersion:      pick(xml, "dbVersion"),
  }
}

export function parseSystemStats(xml: string): SystemStats {
  const ts =
    /<timestamp>\s*<time>(\d+)<\/time>/.exec(xml)?.[1] ?? "0"
  return {
    timestamp:            parseInt(ts, 10) || 0,
    cpuUsagePct:          num(xml, "cpuUsagePct"),
    allocatedMemoryBytes: num(xml, "allocatedMemoryBytes"),
    freeMemoryBytes:      num(xml, "freeMemoryBytes"),
    maxMemoryBytes:       num(xml, "maxMemoryBytes"),
    diskFreeBytes:        num(xml, "diskFreeBytes"),
    diskTotalBytes:       num(xml, "diskTotalBytes"),
  }
}

const VALID_LEVELS = new Set(["INFORMATION", "WARNING", "ERROR", "DEBUG", "TRACE"])
const VALID_OUTCOMES = new Set(["SUCCESS", "FAILURE", "UNKNOWN"])

function unescape(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
}

export function parseEvents(xml: string): ServerEvent[] {
  const out: ServerEvent[] = []
  const re = /<event>([\s\S]*?)<\/event>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(xml)) !== null) {
    const body = m[1]
    const id = pick(body, "id") || ""
    const eventTime = parseInt(
      /<eventTime>\s*<time>(\d+)<\/time>/.exec(body)?.[1] ?? "0",
      10
    )
    const rawLevel = pick(body, "level")
    const level: EventLevel = (VALID_LEVELS.has(rawLevel) ? rawLevel : "INFORMATION") as EventLevel
    const name = unescape(pick(body, "name"))
    const rawOutcome = pick(body, "outcome")
    const outcome: EventOutcome = (VALID_OUTCOMES.has(rawOutcome) ? rawOutcome : "UNKNOWN") as EventOutcome

    // Attributes — entries of <entry><string>k</string><string>v</string></entry>
    const attributes: Record<string, string> = {}
    const attrRe = /<entry>\s*<string>([\s\S]*?)<\/string>\s*<string>([\s\S]*?)<\/string>\s*<\/entry>/g
    let am: RegExpExecArray | null
    while ((am = attrRe.exec(body)) !== null) {
      attributes[unescape(am[1])] = unescape(am[2])
    }

    out.push({
      id,
      eventTime,
      level,
      name,
      outcome,
      userId:    pick(body, "userId"),
      ipAddress: pick(body, "ipAddress"),
      attributes,
    })
  }
  return out
}

export function parseChannelGroups(xml: string): ChannelGroup[] {
  const out: ChannelGroup[] = []
  const groupRe = /<channelGroup[^>]*>([\s\S]*?)<\/channelGroup>/g
  let m: RegExpExecArray | null
  while ((m = groupRe.exec(xml)) !== null) {
    const body = m[1]
    const id = pick(body, "id")
    const name = unescape(pick(body, "name"))
    const description = unescape(pick(body, "description"))
    const channelIds: string[] = []
    const chRe = /<channel[^>]*>\s*<id>([a-f0-9-]+)<\/id>/g
    let cm: RegExpExecArray | null
    while ((cm = chRe.exec(body)) !== null) channelIds.push(cm[1])
    out.push({ id, name, description, channelIds })
  }
  return out
}
