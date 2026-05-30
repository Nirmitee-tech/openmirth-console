import { getIronSession, type SessionOptions, type IronSession } from "iron-session"
import { cookies } from "next/headers"
import { z } from "zod"
import { getEnv } from "@/lib/env"
import { isRole, type Role } from "./roles"

/**
 * Iron-session encrypted cookie. Stores ONLY what we need to authorize
 * requests — the Mirth credentials are NOT stored here; the server-side
 * MirthClient holds those out-of-band.
 *
 * Session is rotated on login, invalidated on logout, and expires after
 * SESSION_TTL_SECONDS (default 8h).
 */
export const SessionDataSchema = z.object({
  username: z.string().min(1),
  role: z.custom<Role>((v) => isRole(v), "Invalid role"),
  loggedInAt: z.number().int().positive(),
  csrfToken: z.string().length(64),
})

export type SessionData = z.infer<typeof SessionDataSchema>

export type Session = IronSession<Partial<SessionData>>

function sessionOptions(): SessionOptions {
  const env = getEnv()
  return {
    password: env.SESSION_PASSWORD,
    cookieName: env.SESSION_COOKIE_NAME,
    ttl: env.SESSION_TTL_SECONDS,
    cookieOptions: {
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    },
  }
}

export async function getSession(): Promise<Session> {
  const store = await cookies()
  return getIronSession<Partial<SessionData>>(store, sessionOptions())
}

/** Throws if the session is missing or malformed. */
export async function requireSession(): Promise<SessionData> {
  const session = await getSession()
  const validated = SessionDataSchema.safeParse(session)
  if (!validated.success) {
    throw new Error("Unauthenticated")
  }
  return validated.data
}

/** Generates a cryptographically-strong CSRF token (32 random bytes hex). */
export function generateCsrfToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")
}
