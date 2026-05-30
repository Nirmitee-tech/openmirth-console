import { childLogger } from "@/lib/logger"
import type { Permission } from "./roles"

const log = childLogger({ component: "audit" })

/**
 * Audit log for privileged actions. Every operator/admin action that
 * mutates state should call audit().
 *
 * The current implementation emits to the structured logger — in a
 * production deploy, route these to a dedicated audit sink (database,
 * SIEM, S3 with object-lock for HIPAA tamper-evidence).
 */
export interface AuditEvent {
  actor: string
  actorRole: string
  permission: Permission
  resource: string
  outcome: "allowed" | "denied" | "error"
  reason?: string
  requestId?: string
  // PHI MUST NEVER appear in this object; the audit log is queried by
  // compliance teams without PHI authorization. Use opaque IDs only.
  extra?: Record<string, string | number | boolean>
}

export function audit(event: AuditEvent): void {
  log.info(
    {
      audit: true,
      ts: new Date().toISOString(),
      ...event,
    },
    `audit.${event.permission}.${event.outcome}`
  )
}
