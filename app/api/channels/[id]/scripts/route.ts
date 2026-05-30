import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { getMirthClient } from "@/lib/mirth/client"
import { MirthError } from "@/lib/mirth/errors"
import { getChannelScripts, patchChannelScripts, type ScriptPatch } from "@/lib/mirth/scripts"
import { authorize, AuthError, verifyCsrf } from "@/lib/auth/authorize"
import { requireSession } from "@/lib/auth/session"
import { childLogger } from "@/lib/logger"

const log = childLogger({ component: "channel-scripts" })

const StepSchema = z.object({
  name: z.string().max(200).default(""),
  enabled: z.boolean().default(true),
  sequenceNumber: z.number().int().nonnegative().default(0),
  script: z.string().max(1_000_000), // 1 MB sanity ceiling
})

const PatchSchema = z.object({
  channelLevel: z
    .object({
      preprocessing: z.string().max(1_000_000).optional(),
      postprocessing: z.string().max(1_000_000).optional(),
      deploy: z.string().max(1_000_000).optional(),
      undeploy: z.string().max(1_000_000).optional(),
    })
    .optional(),
  source: z
    .object({
      transformerSteps: z.array(StepSchema).optional(),
      filterRules: z.array(StepSchema).optional(),
    })
    .optional(),
  destinations: z
    .array(
      z.object({
        metaDataId: z.number().int().nonnegative(),
        transformerSteps: z.array(StepSchema).optional(),
        filterRules: z.array(StepSchema).optional(),
        responseTransformerSteps: z.array(StepSchema).optional(),
      })
    )
    .optional(),
  csrfToken: z.string().length(64),
  /** Whether to redeploy the channel after saving so changes take effect. */
  redeploy: z.boolean().default(true),
})

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await ctx.params
  try {
    await authorize("system:read", id)
  } catch (e) {
    const status = e instanceof AuthError ? e.status : 401
    return NextResponse.json({ error: "Unauthorized" }, { status })
  }
  try {
    const xml = await getMirthClient().getChannelXml(id)
    const scripts = getChannelScripts(xml)
    return NextResponse.json(scripts)
  } catch (e) {
    log.error({ err: (e as Error).message, channelId: id }, "scripts GET failed")
    return NextResponse.json(
      { error: e instanceof MirthError ? e.message : "Unable to load channel scripts" },
      { status: 502 }
    )
  }
}

export async function PUT(
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
  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid script patch", issues: parsed.error.issues },
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
    await authorize("channel:update", id)
  } catch (e) {
    const status = e instanceof AuthError ? e.status : 403
    return NextResponse.json({ error: "Forbidden" }, { status })
  }

  const client = getMirthClient()
  try {
    const currentXml = await client.getChannelXml(id)
    const patch: ScriptPatch = {
      channelLevel: parsed.data.channelLevel,
      source: parsed.data.source,
      destinations: parsed.data.destinations,
    }
    const newXml = patchChannelScripts(currentXml, patch)
    await client.updateChannel(id, newXml)
    if (parsed.data.redeploy) {
      await client.deployChannel(id).catch((e) => {
        log.warn(
          { err: (e as Error).message, channelId: id },
          "redeploy after script save failed (channel still saved)"
        )
      })
    }
    log.info(
      { channelId: id, actor: session.username, redeploy: parsed.data.redeploy },
      "channel scripts updated"
    )
    return NextResponse.json({ ok: true, redeployed: parsed.data.redeploy })
  } catch (e) {
    log.error({ err: (e as Error).message, channelId: id }, "scripts PUT failed")
    return NextResponse.json(
      { error: e instanceof MirthError ? e.message : "Unable to save scripts" },
      { status: 502 }
    )
  }
}
