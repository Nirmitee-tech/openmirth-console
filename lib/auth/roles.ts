/**
 * RBAC role model.
 *
 * Three roles, monotonically more privileged:
 *   - viewer:    read-only access to channels, messages, dashboards
 *   - operator:  viewer + start/stop channels, replay messages, redeploy
 *   - admin:     operator + create/delete channels, edit config, manage users
 *
 * Permissions are NOT additive bags — they are derived from the role
 * ordinal. This keeps the model auditable and impossible to "partially"
 * grant a role.
 */

export const ROLES = ["viewer", "operator", "admin"] as const
export type Role = (typeof ROLES)[number]

const ROLE_LEVEL: Record<Role, number> = {
  viewer: 10,
  operator: 20,
  admin: 30,
}

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value)
}

/** True if `actual` meets or exceeds the minimum required role. */
export function hasMinimumRole(actual: Role, required: Role): boolean {
  return ROLE_LEVEL[actual] >= ROLE_LEVEL[required]
}

/** Permission catalog — every privileged action lives here for audit. */
export const PERMISSIONS = {
  // Channel mutations
  "channel:start": "operator",
  "channel:stop": "operator",
  "channel:pause": "operator",
  "channel:deploy": "operator",
  "channel:create": "admin",
  "channel:delete": "admin",
  "channel:update": "admin",
  // Message operations
  "message:read": "viewer",
  "message:reprocess": "operator",
  "message:purge": "admin",
  // System
  "system:read": "viewer",
  "system:configure": "admin",
  "users:manage": "admin",
} as const satisfies Record<string, Role>

export type Permission = keyof typeof PERMISSIONS

export function permit(actual: Role, permission: Permission): boolean {
  return hasMinimumRole(actual, PERMISSIONS[permission])
}
