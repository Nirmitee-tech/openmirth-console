import { getEnv } from "@/lib/env"
import { hasMinimumRole, type Role } from "./roles"

/**
 * Server-side username → role resolution.
 *
 * The role is NEVER trusted from the client. It is derived from the
 * environment-driven role map at login time, after credentials are
 * verified against Mirth.
 *
 * Behavior:
 *   - Most-privileged tier wins: a user listed in both OMCC_ROLE_ADMIN
 *     and OMCC_ROLE_VIEWER gets admin.
 *   - "*" in a tier grants that tier to every authenticated user.
 *     This is convenient for the viewer tier in trusted intranets;
 *     never use it for admin/operator.
 *   - Closed-world default: a user not in any tier is denied login.
 *     This matches the principle of least privilege.
 *   - Username comparison is case-insensitive (Mirth itself is
 *     case-insensitive for the bootstrap admin account).
 */
export type RoleLookupResult =
  | { granted: true; role: Role }
  | { granted: false; reason: string }

function parseAllowlist(spec: string): { wildcard: boolean; users: Set<string> } {
  const tokens = spec
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
  return {
    wildcard: tokens.includes("*"),
    users: new Set(tokens.filter((t) => t !== "*")),
  }
}

export interface RoleMap {
  admin: ReturnType<typeof parseAllowlist>
  operator: ReturnType<typeof parseAllowlist>
  viewer: ReturnType<typeof parseAllowlist>
}

export function buildRoleMap(env = getEnv()): RoleMap {
  return {
    admin: parseAllowlist(env.OMCC_ROLE_ADMIN),
    operator: parseAllowlist(env.OMCC_ROLE_OPERATOR),
    viewer: parseAllowlist(env.OMCC_ROLE_VIEWER),
  }
}

export function resolveRoleFromMap(username: string, map: RoleMap): RoleLookupResult {
  const u = username.trim().toLowerCase()
  // Highest privilege wins
  for (const tier of ["admin", "operator", "viewer"] as const) {
    const list = map[tier]
    if (list.users.has(u) || list.wildcard) {
      return { granted: true, role: tier }
    }
  }
  return {
    granted: false,
    reason: `Username "${username}" is not configured for any role. ` +
            `Set OMCC_ROLE_ADMIN, OMCC_ROLE_OPERATOR, or OMCC_ROLE_VIEWER.`,
  }
}

export function resolveRole(username: string): RoleLookupResult {
  return resolveRoleFromMap(username, buildRoleMap())
}

/**
 * Quick lookup helper used by docs and audit: what's the minimum role
 * a user must have to be allowed in at all? (i.e., does the deploy
 * have any role configured?)
 */
export function isAnyRoleConfigured(env = getEnv()): boolean {
  const map = buildRoleMap(env)
  return (
    map.admin.wildcard || map.admin.users.size > 0 ||
    map.operator.wildcard || map.operator.users.size > 0 ||
    map.viewer.wildcard || map.viewer.users.size > 0
  )
}

// Re-export for callers that need both
export { hasMinimumRole }
