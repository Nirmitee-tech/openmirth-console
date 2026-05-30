import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { MirthClient } from "@/lib/mirth/client"
import { MirthAuthError } from "@/lib/mirth/errors"
import { getEnv } from "@/lib/env"
import { childLogger } from "@/lib/logger"
import { authEvents } from "@/lib/metrics"
import { generateCsrfToken, getSession } from "@/lib/auth/session"
import { resolveRole } from "@/lib/auth/role-resolver"

const log = childLogger({ component: "auth-login" })

const LoginRequestSchema = z.object({
  username: z.string().min(1).max(128),
  password: z.string().min(1).max(1024),
})

/**
 * Local-redirect guard. Strips any next= target that is not a same-origin
 * absolute path. Defends against open-redirect via crafted next= params.
 */
function safeNext(value: string | null | undefined): string {
  if (!value) return "/"
  // Must start with exactly one "/" — reject protocol-relative ("//evil"),
  // backslash variants ("/\\evil"), and absolute URLs.
  if (!value.startsWith("/")) return "/"
  if (value.startsWith("//") || value.startsWith("/\\")) return "/"
  if (/^\/[a-zA-Z][a-zA-Z0-9+.-]*:/.test(value)) return "/"
  return value
}

async function parseBody(req: NextRequest): Promise<unknown> {
  const ct = req.headers.get("content-type") ?? ""
  if (ct.includes("application/json")) {
    try {
      return await req.json()
    } catch {
      return null
    }
  }
  if (ct.includes("application/x-www-form-urlencoded") || ct.includes("multipart/form-data")) {
    const form = await req.formData()
    return Object.fromEntries(form.entries())
  }
  return null
}

/**
 * Login flow.
 *
 * Accepts both `application/json` (XHR from the React form) and
 * `application/x-www-form-urlencoded` (browser native form submit when
 * JavaScript is disabled / hasn't hydrated yet). This gives us
 * progressive enhancement — the form works even without JS.
 *
 * Steps:
 *   1. Parse + validate body.
 *   2. Verify credentials against Mirth (auth proxy).
 *   3. Resolve role server-side from the env-driven role map.
 *      Users not in any tier are denied.
 *   4. Mint a fresh encrypted session cookie with a new CSRF token.
 *   5. JSON callers get the session payload; form callers get a 302
 *      to the validated `next` location.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = await parseBody(req)
  const parsed = LoginRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid login payload", issues: parsed.error.issues },
      { status: 400 }
    )
  }
  const { username, password } = parsed.data
  const env = getEnv()
  const wantsJson = (req.headers.get("accept") ?? "").includes("application/json")
  const nextUrl = safeNext(req.nextUrl.searchParams.get("next") ?? new URL(req.url).searchParams.get("next"))

  // Probe Mirth with the submitted credentials. Use an isolated client so
  // we don't poison the long-lived MirthClient singleton with wrong creds.
  try {
    const probe = new MirthClient(env.MIRTH_URL, username, password, {
      insecureSkipVerify: env.MIRTH_INSECURE_SKIP_VERIFY,
    })
    await probe.serverVersion()
  } catch (e) {
    if (e instanceof MirthAuthError) {
      authEvents.inc({ kind: "login", outcome: "denied" })
      log.info({ username }, "login denied: bad credentials")
      return wantsJson
        ? NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
        : redirectToLogin(req, nextUrl, "invalid_credentials")
    }
    authEvents.inc({ kind: "login", outcome: "error" })
    log.error({ err: (e as Error).message }, "login probe failed (Mirth unreachable)")
    return wantsJson
      ? NextResponse.json(
          { error: "Mirth Connect is currently unreachable. Please try again." },
          { status: 503 }
        )
      : redirectToLogin(req, nextUrl, "mirth_unreachable")
  }

  // Server-side role derivation — NEVER trust a client-supplied role.
  const lookup = resolveRole(username)
  if (!lookup.granted) {
    authEvents.inc({ kind: "login", outcome: "denied" })
    log.warn({ username, reason: lookup.reason }, "login denied: no role assigned")
    return wantsJson
      ? NextResponse.json({ error: "Account not authorized for this console" }, { status: 403 })
      : redirectToLogin(req, nextUrl, "no_role")
  }

  const session = await getSession()
  session.username = username
  session.role = lookup.role
  session.loggedInAt = Date.now()
  session.csrfToken = generateCsrfToken()
  await session.save()

  authEvents.inc({ kind: "login", outcome: "allowed" })
  log.info({ username, role: lookup.role }, "login allowed")

  if (wantsJson) {
    return NextResponse.json({
      username: session.username,
      role: session.role,
      csrfToken: session.csrfToken,
    })
  }
  return NextResponse.redirect(new URL(nextUrl, req.url), 303)
}

function redirectToLogin(req: NextRequest, nextUrl: string, error: string): NextResponse {
  const url = new URL("/login", req.url)
  url.searchParams.set("error", error)
  if (nextUrl !== "/") url.searchParams.set("next", nextUrl)
  return NextResponse.redirect(url, 303)
}
