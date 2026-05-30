import { audit } from "./audit"
import { permit, type Permission, type Role } from "./roles"
import { requireSession, type SessionData } from "./session"
import { getRequestId } from "@/lib/request-context"

export class AuthError extends Error {
  override readonly name = "AuthError"
  constructor(public readonly status: number, message: string) {
    super(message)
  }
}

/**
 * Authorize a request for a specific permission.
 *
 * - Throws AuthError(401) if not logged in
 * - Throws AuthError(403) if role doesn't grant the permission
 * - Emits an audit event in both allow and deny cases
 *
 * `resource` is an opaque identifier (channel id, message id, etc.) — never PHI.
 */
export async function authorize(
  permission: Permission,
  resource: string
): Promise<SessionData> {
  let session: SessionData
  try {
    session = await requireSession()
  } catch {
    audit({
      actor: "unknown",
      actorRole: "anonymous",
      permission,
      resource,
      outcome: "denied",
      reason: "no_session",
      requestId: getRequestId(),
    })
    throw new AuthError(401, "Authentication required")
  }

  const allowed = permit(session.role, permission)
  audit({
    actor: session.username,
    actorRole: session.role,
    permission,
    resource,
    outcome: allowed ? "allowed" : "denied",
    reason: allowed ? undefined : "insufficient_role",
    requestId: getRequestId(),
  })

  if (!allowed) {
    throw new AuthError(403, `Role "${session.role}" cannot ${permission}`)
  }
  return session
}

/** Verifies the CSRF token from a form submission or fetch request. */
export function verifyCsrf(submitted: string | null | undefined, expected: string): void {
  if (!submitted || submitted.length !== expected.length) {
    throw new AuthError(403, "Invalid CSRF token")
  }
  // Constant-time comparison
  let mismatch = 0
  for (let i = 0; i < submitted.length; i++) {
    mismatch |= submitted.charCodeAt(i) ^ expected.charCodeAt(i)
  }
  if (mismatch !== 0) throw new AuthError(403, "Invalid CSRF token")
}

/** Convenience type for the union of all permissions */
export type { Permission, Role }
