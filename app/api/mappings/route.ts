import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { getMirthClient } from "@/lib/mirth/client"
import { MirthError } from "@/lib/mirth/errors"
import { authorize, AuthError, verifyCsrf } from "@/lib/auth/authorize"
import { requireSession } from "@/lib/auth/session"
import { childLogger } from "@/lib/logger"

const log = childLogger({ component: "mappings-api" })

const UpdateSchema = z.object({
  entries: z.record(z.string().min(1).max(256), z.string().max(8192)),
  csrfToken: z.string().length(64),
})

export async function GET(): Promise<NextResponse> {
  try {
    await authorize("system:read", "configurationMap")
  } catch (e) {
    const status = e instanceof AuthError ? e.status : 401
    return NextResponse.json({ error: "Unauthorized" }, { status })
  }
  try {
    const entries = await getMirthClient().getConfigurationMap()
    return NextResponse.json({ entries })
  } catch (e) {
    log.error({ err: (e as Error).message }, "configurationMap GET failed")
    const message = e instanceof MirthError ? e.message : "Unable to read configuration map"
    return NextResponse.json({ error: message }, { status: 502 })
  }
}

export async function PUT(req: NextRequest): Promise<NextResponse> {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }
  const parsed = UpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid mapping payload", issues: parsed.error.issues },
      { status: 400 }
    )
  }

  let session
  try {
    session = await requireSession()
    verifyCsrf(parsed.data.csrfToken, session.csrfToken)
  } catch (e) {
    const status = e instanceof AuthError ? e.status : 401
    return NextResponse.json({ error: "Unauthorized" }, { status })
  }

  try {
    await authorize("system:configure", "configurationMap")
  } catch (e) {
    const status = e instanceof AuthError ? e.status : 403
    return NextResponse.json({ error: "Forbidden" }, { status })
  }

  try {
    await getMirthClient().setConfigurationMap(parsed.data.entries)
    log.info(
      { actor: session.username, entryCount: Object.keys(parsed.data.entries).length },
      "configurationMap PUT ok"
    )
    return NextResponse.json({ ok: true, count: Object.keys(parsed.data.entries).length })
  } catch (e) {
    log.error({ err: (e as Error).message }, "configurationMap PUT failed")
    const message = e instanceof MirthError ? e.message : "Unable to write configuration map"
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
