import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { getMirthClient } from "@/lib/mirth/client"
import { MirthError } from "@/lib/mirth/errors"
import { authorize, AuthError, verifyCsrf } from "@/lib/auth/authorize"
import { requireSession } from "@/lib/auth/session"
import { childLogger } from "@/lib/logger"

const log = childLogger({ component: "channel-action" })

const ActionSchema = z.object({
  action: z.enum(["start", "stop", "pause", "resume", "halt", "deploy", "undeploy"]),
  csrfToken: z.string().length(64),
})

const PERMISSION_BY_ACTION = {
  start: "channel:start",
  stop: "channel:stop",
  pause: "channel:pause",
  resume: "channel:start",
  halt: "channel:stop",
  deploy: "channel:deploy",
  undeploy: "channel:deploy",
} as const satisfies Record<z.infer<typeof ActionSchema>["action"], Parameters<typeof authorize>[0]>

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await ctx.params

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }
  const parsed = ActionSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid action payload", issues: parsed.error.issues },
      { status: 400 }
    )
  }

  // CSRF: cookie's token must match the submitted one.
  let session
  try {
    session = await requireSession()
    verifyCsrf(parsed.data.csrfToken, session.csrfToken)
  } catch (e) {
    const status = e instanceof AuthError ? e.status : 401
    return NextResponse.json({ error: "Unauthorized" }, { status })
  }

  // RBAC + audit
  try {
    await authorize(PERMISSION_BY_ACTION[parsed.data.action], id)
  } catch (e) {
    const status = e instanceof AuthError ? e.status : 403
    return NextResponse.json({ error: "Forbidden" }, { status })
  }

  // Execute
  const client = getMirthClient()
  try {
    switch (parsed.data.action) {
      case "start":    await client.startChannel(id); break
      case "stop":     await client.stopChannel(id); break
      case "pause":    await client.pauseChannel(id); break
      case "resume":   await client.resumeChannel(id); break
      case "halt":     await client.haltChannel(id); break
      case "deploy":   await client.deployChannel(id); break
      case "undeploy": await client.undeployChannel(id); break
    }
    log.info({ channelId: id, action: parsed.data.action, actor: session.username }, "channel action ok")
    return NextResponse.json({ ok: true, action: parsed.data.action })
  } catch (e) {
    log.error(
      { channelId: id, action: parsed.data.action, err: (e as Error).message },
      "channel action failed"
    )
    const message =
      e instanceof MirthError ? e.message : "Failed to execute channel action"
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
