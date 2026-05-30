import { getMirthClient } from "@/lib/mirth/client"
import { MirthError } from "@/lib/mirth/errors"
import { getSession } from "@/lib/auth/session"
import { permit } from "@/lib/auth/roles"
import { childLogger } from "@/lib/logger"
import { MappingsEditor } from "./mappings-editor"

const log = childLogger({ component: "mappings-page" })

export const dynamic = "force-dynamic"

export default async function MappingsPage() {
  const session = await getSession()
  const role = session.role ?? "viewer"
  const csrfToken = session.csrfToken ?? ""
  const canEdit = permit(role, "system:configure")

  let entries: Record<string, string> = {}
  let error: string | null = null
  try {
    entries = await getMirthClient().getConfigurationMap()
  } catch (e) {
    log.error({ err: (e as Error).message }, "mappings fetch failed")
    error = e instanceof MirthError ? e.message : "Unable to read mappings"
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-ink-900">Mappings</h1>
        <p className="text-sm text-ink-600 mt-1 max-w-3xl">
          The Configuration Map is Mirth&apos;s server-level key/value store. Channels
          reference values via <code>configurationMap.get(&apos;FACILITY_NPI&apos;)</code> —
          use it for environment-specific endpoints, terminology mappings,
          per-deploy secrets, and reference data shared across channels.
        </p>
      </header>

      {error ? (
        <div className="rounded border border-red-200 bg-red-50 text-red-900 px-4 py-3 text-sm">
          {error}
        </div>
      ) : null}

      <MappingsEditor initial={entries} canEdit={canEdit} csrfToken={csrfToken} />

      <details className="bg-white rounded border border-ink-200 p-4 text-sm text-ink-700">
        <summary className="cursor-pointer font-medium text-ink-900">
          How channels reference these values
        </summary>
        <div className="mt-3 space-y-3">
          <p>From any transformer or source/destination script:</p>
          <pre className="bg-ink-50 p-3 rounded text-xs font-mono overflow-x-auto">
{`// Read a single value
var npi = configurationMap.get('FACILITY_NPI');

// Read with a default
var endpoint = configurationMap.get('LAB_ENDPOINT') || 'http://lab-default';

// Use inline in template (no code)
\${configurationMap.get('LAB_ENDPOINT')}`}
          </pre>
        </div>
      </details>
    </div>
  )
}
