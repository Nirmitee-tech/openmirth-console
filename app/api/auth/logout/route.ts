import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth/session"
import { authEvents } from "@/lib/metrics"

export async function POST(): Promise<NextResponse> {
  const session = await getSession()
  session.destroy()
  authEvents.inc({ kind: "logout", outcome: "allowed" })
  // 204 No Content is the canonical response for "you are logged out"
  return new NextResponse(null, { status: 204 })
}
