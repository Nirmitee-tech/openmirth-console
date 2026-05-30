import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { randomUUID } from "node:crypto"
import { getMirthClient } from "@/lib/mirth/client"
import { MirthError } from "@/lib/mirth/errors"
import { authorize, AuthError, verifyCsrf } from "@/lib/auth/authorize"
import { requireSession } from "@/lib/auth/session"
import { childLogger } from "@/lib/logger"
import { buildChannelXml, TemplateInputSchema } from "@/lib/mirth/templates"

const log = childLogger({ component: "channel-create" })

const RequestSchema = z.object({
  template: TemplateInputSchema,
  csrfToken: z.string().length(64),
})

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }
  const parsed = RequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", issues: parsed.error.issues },
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
    await authorize("channel:create", "new-channel")
  } catch (e) {
    const status = e instanceof AuthError ? e.status : 403
    return NextResponse.json({ error: "Forbidden" }, { status })
  }

  const id = randomUUID()
  const xml = buildChannelXml(parsed.data.template, id)
  const client = getMirthClient()
  try {
    await client.createChannel(xml)
    await client.setChannelEnabled(id, true)
    await client.deployChannel(id)
    log.info(
      { id, name: parsed.data.template.name, template: parsed.data.template.template, actor: session.username },
      "channel created + deployed"
    )
    return NextResponse.json({ ok: true, id })
  } catch (e) {
    log.error({ err: (e as Error).message }, "channel create failed")
    return NextResponse.json(
      { error: e instanceof MirthError ? e.message : "Channel creation failed" },
      { status: 502 }
    )
  }
}
