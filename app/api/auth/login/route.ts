import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { MirthClient } from "@/lib/mirth/client"
import { MirthAuthError } from "@/lib/mirth/errors"
import { getEnv } from "@/lib/env"
import { childLogger } from "@/lib/logger"
import { authEvents } from "@/lib/metrics"
import { generateCsrfToken, getSession } from "@/lib/auth/session"
import { isRole, type Role } from "@/lib/auth/roles"

const log = childLogger({ component: "auth-login" })

const LoginRequestSchema = z.object({
  username: z.string().min(1).max(128),
  password: z.string().min(1).max(1024),
  role: z.custom<Role>((v) => isRole(v), "Invalid role"),
})

/**
 * Login flow.
 *
 * The user submits {username, password, role}. We verify the credentials
 * by attempting a Mirth login with them (cheap auth proxy — no separate
 * IdP needed for the initial release). On success, the requested role
 * is stored in the encrypted session cookie.
 *
 * The `role` field is currently self-declared by the user (intended for
 * SSO/OIDC integration in a follow-up). In Phase 2 we replace this with
 * group-claim mapping from the IdP.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const parsed = LoginRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid login payload", issues: parsed.error.issues },
      { status: 400 }
    )
  }

  const env = getEnv()

  // Probe Mirth with the submitted credentials. Construct a one-off
  // client so we don't poison the long-lived singleton with the wrong creds.
  let mirthReachable = true
  try {
    const probe = new MirthClient(env.MIRTH_URL, parsed.data.username, parsed.data.password, {
      insecureSkipVerify: env.MIRTH_INSECURE_SKIP_VERIFY,
    })
    await probe.serverVersion()
  } catch (e) {
    if (e instanceof MirthAuthError) {
      authEvents.inc({ kind: "login", outcome: "denied" })
      log.info({ username: parsed.data.username }, "login denied: bad credentials")
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
    }
    mirthReachable = false
    authEvents.inc({ kind: "login", outcome: "error" })
    log.error({ err: (e as Error).message }, "login probe failed (Mirth unreachable)")
  }

  if (!mirthReachable) {
    return NextResponse.json(
      { error: "Mirth Connect is currently unreachable. Please try again." },
      { status: 503 }
    )
  }

  const session = await getSession()
  session.username = parsed.data.username
  session.role = parsed.data.role
  session.loggedInAt = Date.now()
  session.csrfToken = generateCsrfToken()
  await session.save()

  authEvents.inc({ kind: "login", outcome: "allowed" })
  log.info({ username: parsed.data.username, role: parsed.data.role }, "login allowed")

  return NextResponse.json({
    username: session.username,
    role: session.role,
    csrfToken: session.csrfToken,
  })
}
