import Link from "next/link"
import { notFound } from "next/navigation"
import { getMirthClient } from "@/lib/mirth/client"
import { MirthError } from "@/lib/mirth/errors"
import { parseMessages, type MirthMessage } from "@/lib/mirth/messages"
import { childLogger } from "@/lib/logger"
import { MessageBrowser } from "./message-browser"

const log = childLogger({ component: "messages-page" })

export const dynamic = "force-dynamic"

export default async function ChannelMessagesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ limit?: string }>
}) {
  const { id } = await params
  const { limit: limitParam } = await searchParams
  const limit = Math.min(Math.max(parseInt(limitParam ?? "25", 10) || 25, 1), 200)

  let messages: MirthMessage[] = []
  let channelName = id
  let error: string | null = null

  try {
    const [xml, channelXml] = await Promise.all([
      getMirthClient().listMessages(id, limit),
      getMirthClient().getChannelXml(id).catch(() => ""),
    ])
    messages = parseMessages(xml)
    channelName =
      /<channel[^>]*>\s*<id>[^<]+<\/id>\s*<nextMetaDataId>[^<]+<\/nextMetaDataId>\s*<name>([\s\S]*?)<\/name>/.exec(
        channelXml
      )?.[1] ?? id
  } catch (e) {
    log.error({ err: (e as Error).message, channelId: id }, "messages page load failed")
    error = e instanceof MirthError ? e.message : "Unable to load messages"
  }

  if (messages.length === 0 && error === null && channelName === id) {
    // Channel itself doesn't exist
    notFound()
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <Link
          href={`/channels/${id}`}
          className="text-sm text-brand-500 hover:underline underline-offset-4"
        >
          ← {channelName || "Channel"}
        </Link>
        <h1 className="text-2xl font-semibold text-ink-900 dark:text-ink-100">Messages</h1>
        <p className="text-sm text-ink-600 dark:text-ink-400 max-w-3xl">
          Recent messages processed by this channel. Click a row to expand and inspect
          the raw, transformed, encoded, and response payloads per connector.
        </p>
      </header>

      {error ? (
        <div className="rounded border border-red-200 bg-red-50 text-red-900 px-4 py-3 text-sm">
          {error}
        </div>
      ) : null}

      <MessageBrowser messages={messages} channelId={id} currentLimit={limit} />
    </div>
  )
}
