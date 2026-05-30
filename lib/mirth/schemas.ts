import { z } from "zod"

/**
 * Zod schemas for every Mirth REST API response we consume.
 *
 * Mirth's XStream XML is awkward — we parse it via fast-xml-parser, then
 * validate against these schemas to catch upstream breakage early. If Mirth
 * ships a 4.6 / 4.7 update that changes a field shape, our parsers fail
 * loudly here instead of silently returning malformed UI data.
 */

// ── Channel statistics — extracted from <statistics><entry> blocks ─────────
export const ChannelStatisticsSchema = z.object({
  received: z.number().int().nonnegative().default(0),
  sent: z.number().int().nonnegative().default(0),
  filtered: z.number().int().nonnegative().default(0),
  errored: z.number().int().nonnegative().default(0),
  queued: z.number().int().nonnegative().default(0),
})
export type ChannelStatistics = z.infer<typeof ChannelStatisticsSchema>

// ── Channel state ──────────────────────────────────────────────────────────
export const ChannelStateSchema = z.enum([
  "STARTED",
  "STOPPED",
  "PAUSED",
  "DEPLOYING",
  "UNDEPLOYING",
  "UNKNOWN",
])
export type ChannelState = z.infer<typeof ChannelStateSchema>

// ── Dashboard status (per channel runtime) ─────────────────────────────────
export const DashboardStatusSchema = z.object({
  channelId: z.string().uuid(),
  name: z.string(),
  state: ChannelStateSchema,
  statistics: ChannelStatisticsSchema,
  deployedRevisionDelta: z.number().int().optional(),
  queueEnabled: z.boolean().optional(),
})
export type DashboardStatus = z.infer<typeof DashboardStatusSchema>

// ── Connector summary (lightweight, derived from channel XML) ──────────────
export const ConnectorSchema = z.object({
  name: z.string(),
  transportName: z.string(),
  enabled: z.boolean().default(true),
  details: z.record(z.string(), z.string()).default({}),
})
export type Connector = z.infer<typeof ConnectorSchema>

// ── Channel definition (subset we render in the UI) ───────────────────────
export const ChannelSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().default(""),
  revision: z.string().default("0"),
  source: ConnectorSchema,
  destinations: z.array(ConnectorSchema),
})
export type Channel = z.infer<typeof ChannelSchema>

// ── Merged channel + runtime state — the shape pages render ───────────────
export const ChannelWithStatusSchema = ChannelSchema.extend({
  state: ChannelStateSchema,
  statistics: ChannelStatisticsSchema,
})
export type ChannelWithStatus = z.infer<typeof ChannelWithStatusSchema>

// ── Server version ─────────────────────────────────────────────────────────
export const ServerVersionSchema = z.string().regex(/^\d+\.\d+\.\d+/)
export type ServerVersion = z.infer<typeof ServerVersionSchema>
