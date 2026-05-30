import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth/session"

export async function GET(): Promise<NextResponse> {
  const session = await getSession()
  if (!session.username) {
    return NextResponse.json({ authenticated: false }, { status: 401 })
  }
  return NextResponse.json({
    authenticated: true,
    username: session.username,
    role: session.role,
    loggedInAt: session.loggedInAt,
    csrfToken: session.csrfToken,
  })
}
