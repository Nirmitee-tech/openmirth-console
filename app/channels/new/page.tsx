import { redirect } from "next/navigation"
import { getMirthClient } from "@/lib/mirth/client"
import { getSession } from "@/lib/auth/session"
import { permit } from "@/lib/auth/roles"
import { TEMPLATE_CATALOG } from "@/lib/mirth/templates"
import { NewChannelForm } from "./new-channel-form"

export const dynamic = "force-dynamic"

export default async function NewChannelPage() {
  const session = await getSession()
  const role = session.role ?? "viewer"
  if (!permit(role, "channel:create")) {
    redirect("/channels?error=forbidden")
  }

  // Pre-fetch existing channels so the user can pick a target channel
  // for Channel Writer destinations from a dropdown.
  let existingChannels: { id: string; name: string }[] = []
  try {
    const all = await getMirthClient().listChannels()
    existingChannels = all.map((c) => ({ id: c.id, name: c.name }))
  } catch {
    // Non-fatal — form will still work without the dropdown
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-ink-900">New channel</h1>
        <p className="text-sm text-ink-600 mt-1 max-w-3xl">
          Create a channel from a hand-tuned template. The console builds a known-good
          Mirth XML body, imports via the REST API, enables it, and deploys.
        </p>
      </header>

      <NewChannelForm
        templates={TEMPLATE_CATALOG}
        csrfToken={session.csrfToken ?? ""}
        existingChannels={existingChannels}
      />
    </div>
  )
}
