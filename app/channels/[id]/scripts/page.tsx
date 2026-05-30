import Link from "next/link"
import { notFound } from "next/navigation"
import { getMirthClient } from "@/lib/mirth/client"
import { MirthError } from "@/lib/mirth/errors"
import { getChannelScripts } from "@/lib/mirth/scripts"
import { getSession } from "@/lib/auth/session"
import { permit } from "@/lib/auth/roles"
import { childLogger } from "@/lib/logger"
import { ScriptsEditor } from "./scripts-editor"

const log = childLogger({ component: "scripts-page" })

export const dynamic = "force-dynamic"

export default async function ChannelScriptsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  let scripts: Awaited<ReturnType<typeof getChannelScripts>> | null = null
  let channelName = ""
  let error: string | null = null

  try {
    const xml = await getMirthClient().getChannelXml(id)
    scripts = getChannelScripts(xml)
    channelName =
      /<channel[^>]*>\s*<id>[^<]+<\/id>\s*<nextMetaDataId>[^<]+<\/nextMetaDataId>\s*<name>([\s\S]*?)<\/name>/.exec(
        xml
      )?.[1] ?? id
  } catch (e) {
    log.error({ err: (e as Error).message, channelId: id }, "scripts page load failed")
    error =
      e instanceof MirthError
        ? e.message
        : "Failed to load channel scripts"
  }

  if (!scripts && !error) notFound()

  const session = await getSession()
  const role = session.role ?? "viewer"
  const canEdit = permit(role, "channel:update")
  const csrfToken = session.csrfToken ?? ""

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <Link
          href={`/channels/${id}`}
          className="text-sm text-brand-500 hover:underline underline-offset-4"
        >
          ← {channelName || "Channel"}
        </Link>
        <h1 className="text-2xl font-semibold text-ink-900">Transformers & Filters</h1>
        <p className="text-sm text-ink-600 max-w-3xl">
          The actual logic of the channel — JavaScript transformers turn raw inbound
          messages into typed outbound payloads; filters accept or reject messages
          before they hit destinations. Channel-level scripts run on deploy and
          pre/post each message.
        </p>
      </header>

      {error ? (
        <div className="rounded border border-red-200 bg-red-50 text-red-900 px-4 py-3 text-sm">
          {error}
        </div>
      ) : null}

      {scripts ? (
        <ScriptsEditor
          channelId={id}
          scripts={scripts}
          canEdit={canEdit}
          csrfToken={csrfToken}
        />
      ) : null}
    </div>
  )
}
