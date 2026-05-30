import { readFileSync } from "node:fs"
import { Agent, type Dispatcher } from "undici"
import { getEnv } from "@/lib/env"
import { childLogger } from "@/lib/logger"
import {
  MirthApiError,
  MirthAuthError,
  MirthSchemaError,
  MirthUnreachableError,
} from "./errors"
import {
  mergeChannelMetadata,
  parseChannels,
  parseConfigurationMap,
  parseStatuses,
  serializeConfigurationMap,
} from "./parser"
import {
  type Channel,
  type ChannelWithStatus,
  type DashboardStatus,
  ServerVersionSchema,
  type ServerVersion,
} from "./schemas"

const log = childLogger({ component: "mirth-client" })

/**
 * MirthClient — typed, validated, session-aware Mirth REST API client.
 *
 * Lifecycle:
 *   1. First call to any method triggers /api/users/_login with the
 *      configured user/pass. The JSESSIONID cookie is stored in-process.
 *   2. Subsequent calls reuse the cookie until Mirth returns 401, at
 *      which point we re-login once and retry the call.
 *   3. All XML responses are parsed and Zod-validated; failures throw
 *      a MirthSchemaError that surfaces the offending shape.
 *
 * TLS strategy (per-request agent, not global env mutation):
 *   - If MIRTH_CA_FILE is set, load that PEM and validate Mirth's cert
 *     against it.
 *   - Otherwise use the system trust store (preferred in containers
 *     where you mount your CA into /etc/ssl/certs).
 *   - MIRTH_INSECURE_SKIP_VERIFY=true bypasses verification entirely
 *     and is forbidden in production by env.ts.
 *
 * Construct via getMirthClient() singleton — direct instantiation is
 * supported for tests that need isolated clients.
 */
export class MirthClient {
  private cookieHeader: string | null = null
  private readonly dispatcher: Dispatcher

  constructor(
    private readonly baseUrl: string,
    private readonly user: string,
    private readonly pass: string,
    options?: { caPem?: string; insecureSkipVerify?: boolean }
  ) {
    const connect: Record<string, unknown> = {
      // Reasonable default; Mirth keep-alives are cheap.
      keepAlive: true,
      keepAliveTimeout: 30_000,
    }
    if (options?.caPem) {
      connect.ca = options.caPem
    }
    if (options?.insecureSkipVerify) {
      // Disabling cert verification at the agent level — does NOT
      // affect global TLS. env.ts already enforces this is not
      // production.
      connect.rejectUnauthorized = false
      log.warn("TLS cert verification disabled for Mirth connection (dev mode)")
    }
    this.dispatcher = new Agent({ connect })
  }

  // ── Public API ────────────────────────────────────────────────────────

  async serverVersion(): Promise<ServerVersion> {
    const text = await this.text("/api/server/version", {
      accept: "text/plain",
    })
    const parsed = ServerVersionSchema.safeParse(text.trim())
    if (!parsed.success) {
      throw new MirthSchemaError(
        `Unexpected server version: "${text}"`,
        parsed.error.issues
      )
    }
    return parsed.data
  }

  async listChannels(): Promise<Channel[]> {
    const xml = await this.text("/api/channels", { accept: "application/xml" })
    return parseChannels(xml)
  }

  async listStatuses(): Promise<DashboardStatus[]> {
    const xml = await this.text("/api/channels/statuses", {
      accept: "application/xml",
    })
    return parseStatuses(xml)
  }

  /**
   * Joins listChannels() + listStatuses() into the shape the UI renders.
   * Channels that exist in storage but aren't deployed are still returned
   * with state="UNKNOWN" and zeroed stats — the UI sorts them to the bottom.
   */
  async listChannelsWithStatus(): Promise<ChannelWithStatus[]> {
    const [channels, statuses] = await Promise.all([
      this.listChannels(),
      this.listStatuses(),
    ])
    const byId = new Map(statuses.map((s) => [s.channelId, s]))

    return channels.map((channel) => {
      const live = byId.get(channel.id)
      return {
        ...channel,
        state: live?.state ?? "UNKNOWN",
        statistics:
          live?.statistics ?? {
            received: 0,
            sent: 0,
            filtered: 0,
            errored: 0,
            queued: 0,
          },
      }
    })
  }

  async getChannel(channelId: string): Promise<ChannelWithStatus | null> {
    const all = await this.listChannelsWithStatus()
    return all.find((c) => c.id === channelId) ?? null
  }

  // ── Channel lifecycle mutations ───────────────────────────────────────

  async startChannel(channelId: string): Promise<void> {
    await this.post(`/api/channels/${encodeURIComponent(channelId)}/_start`)
  }
  async stopChannel(channelId: string): Promise<void> {
    await this.post(`/api/channels/${encodeURIComponent(channelId)}/_stop`)
  }
  async pauseChannel(channelId: string): Promise<void> {
    await this.post(`/api/channels/${encodeURIComponent(channelId)}/_pause`)
  }
  async resumeChannel(channelId: string): Promise<void> {
    await this.post(`/api/channels/${encodeURIComponent(channelId)}/_resume`)
  }
  async haltChannel(channelId: string): Promise<void> {
    await this.post(`/api/channels/${encodeURIComponent(channelId)}/_halt`)
  }
  async deployChannel(channelId: string): Promise<void> {
    await this.post(`/api/channels/${encodeURIComponent(channelId)}/_deploy`)
  }
  async undeployChannel(channelId: string): Promise<void> {
    await this.post(`/api/channels/${encodeURIComponent(channelId)}/_undeploy`)
  }
  async redeployAll(): Promise<void> {
    await this.post(`/api/channels/_redeployAll`)
  }

  /**
   * Create a channel from an already-serialized XStream XML body.
   * Caller is responsible for producing valid XML — typically by
   * cloning a known-good template and modifying fields.
   */
  async createChannel(channelXml: string): Promise<void> {
    await this.post(`/api/channels`, channelXml, "application/xml")
  }

  /** Raw XML for a single channel — used by the script editor. */
  async getChannelXml(channelId: string): Promise<string> {
    return await this.text(`/api/channels/${encodeURIComponent(channelId)}`, {
      accept: "application/xml",
    })
  }

  /**
   * Replace a channel's XML in-place. Used after the script editor
   * patches transformer/filter blocks. Mirth bumps the revision number
   * server-side; we redeploy to make changes take effect at runtime.
   */
  async updateChannel(channelId: string, channelXml: string): Promise<void> {
    await this.put(
      `/api/channels/${encodeURIComponent(channelId)}`,
      channelXml,
      "application/xml"
    )
  }

  /** Fetch the most recent messages processed by a channel. */
  async listMessages(channelId: string, limit = 25): Promise<string> {
    const path =
      `/api/channels/${encodeURIComponent(channelId)}/messages` +
      `?limit=${limit}&offset=0&includeContent=true`
    return await this.text(path, { accept: "application/xml" })
  }

  /**
   * Set the enabled flag on a channel via the channelMetadata map.
   * Required after createChannel() before a _deploy will take effect.
   *
   * IMPORTANT: PUT /api/server/channelMetadata REPLACES the entire map.
   * We must GET the existing map first, splice in / update our entry,
   * and PUT the merged version back. Failing to do this wipes the
   * metadata (initialState, pruning settings, enabled flag) for every
   * other channel on the server — a critical production bug.
   */
  async setChannelEnabled(channelId: string, enabled: boolean): Promise<void> {
    const currentXml = await this.text(`/api/server/channelMetadata`, {
      accept: "application/xml",
    })
    const merged = mergeChannelMetadata(currentXml, channelId, enabled)
    await this.put(`/api/server/channelMetadata`, merged, "application/xml")
  }

  // ── Configuration map (key/value lookups channels reference) ─────────

  async getConfigurationMap(): Promise<Record<string, string>> {
    const xml = await this.text(`/api/server/configurationMap`, {
      accept: "application/xml",
    })
    return parseConfigurationMap(xml)
  }

  async setConfigurationMap(entries: Record<string, string>): Promise<void> {
    await this.put(`/api/server/configurationMap`, serializeConfigurationMap(entries), "application/xml")
  }

  // ── Internals ─────────────────────────────────────────────────────────

  private async login(): Promise<void> {
    const url = `${this.baseUrl}/api/users/_login`
    const body = new URLSearchParams({
      username: this.user,
      password: this.pass,
    }).toString()

    let resp: Response
    try {
      resp = await fetch(url, {
        method: "POST",
        body,
        headers: {
          "X-Requested-With": "OpenMirthConsole",
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        // @ts-expect-error: undici dispatcher accepted by Node fetch
        dispatcher: this.dispatcher,
      })
    } catch (e) {
      throw new MirthUnreachableError(`Cannot reach ${url}`, e)
    }

    if (resp.status === 401 || resp.status === 403) {
      throw new MirthAuthError(
        `Mirth rejected credentials for user "${this.user}" (status ${resp.status})`
      )
    }
    if (!resp.ok) {
      throw new MirthApiError(
        `Mirth login failed`,
        resp.status,
        await safeReadBody(resp)
      )
    }

    const setCookie = resp.headers.get("set-cookie")
    if (!setCookie) {
      throw new MirthAuthError(
        "Mirth login returned no Set-Cookie header; cannot maintain session"
      )
    }
    // Extract only the JSESSIONID portion; ignore Path/Expires for the
    // outbound Cookie header.
    const sessionMatch = /JSESSIONID=[^;]+/.exec(setCookie)
    if (!sessionMatch) {
      throw new MirthAuthError(
        `Mirth Set-Cookie missing JSESSIONID: "${setCookie}"`
      )
    }
    this.cookieHeader = sessionMatch[0]
    log.debug("Mirth login successful")
  }

  private async post(
    path: string,
    body?: string,
    contentType = "application/x-www-form-urlencoded"
  ): Promise<void> {
    if (!this.cookieHeader) await this.login()
    const url = `${this.baseUrl}${path}`
    const headers: Record<string, string> = {
      "X-Requested-With": "OpenMirthConsole",
      Accept: "application/json",
      Cookie: this.cookieHeader!,
    }
    if (body !== undefined) headers["Content-Type"] = contentType

    let resp: Response
    try {
      resp = await fetch(url, {
        method: "POST",
        body,
        headers,
        // @ts-expect-error: undici dispatcher accepted by Node fetch
        dispatcher: this.dispatcher,
      })
    } catch (e) {
      throw new MirthUnreachableError(`Cannot reach ${url}`, e)
    }

    if (resp.status === 401) {
      this.cookieHeader = null
      await this.login()
      headers.Cookie = this.cookieHeader!
      try {
        resp = await fetch(url, {
          method: "POST",
          body,
          headers,
          // @ts-expect-error: dispatcher
          dispatcher: this.dispatcher,
        })
      } catch (e) {
        throw new MirthUnreachableError(`Cannot reach ${url}`, e)
      }
    }

    if (!resp.ok) {
      throw new MirthApiError(
        `Mirth POST ${path} returned ${resp.status}`,
        resp.status,
        await safeReadBody(resp)
      )
    }
  }

  private async put(
    path: string,
    body: string,
    contentType = "application/xml"
  ): Promise<void> {
    if (!this.cookieHeader) await this.login()
    const url = `${this.baseUrl}${path}`
    const headers: Record<string, string> = {
      "X-Requested-With": "OpenMirthConsole",
      "Content-Type": contentType,
      Accept: "application/json",
      Cookie: this.cookieHeader!,
    }
    let resp: Response
    try {
      resp = await fetch(url, {
        method: "PUT",
        body,
        headers,
        // @ts-expect-error: dispatcher
        dispatcher: this.dispatcher,
      })
    } catch (e) {
      throw new MirthUnreachableError(`Cannot reach ${url}`, e)
    }
    if (resp.status === 401) {
      this.cookieHeader = null
      await this.login()
      headers.Cookie = this.cookieHeader!
      try {
        resp = await fetch(url, {
          method: "PUT",
          body,
          headers,
          // @ts-expect-error: dispatcher
          dispatcher: this.dispatcher,
        })
      } catch (e) {
        throw new MirthUnreachableError(`Cannot reach ${url}`, e)
      }
    }
    if (!resp.ok) {
      throw new MirthApiError(
        `Mirth PUT ${path} returned ${resp.status}`,
        resp.status,
        await safeReadBody(resp)
      )
    }
  }

  private async text(
    path: string,
    opts: { accept: string }
  ): Promise<string> {
    if (!this.cookieHeader) {
      await this.login()
    }

    const url = `${this.baseUrl}${path}`
    const headers: Record<string, string> = {
      "X-Requested-With": "OpenMirthConsole",
      Accept: opts.accept,
      Cookie: this.cookieHeader!,
    }

    let resp: Response
    try {
      resp = await fetch(url, {
        method: "GET",
        headers,
        // @ts-expect-error: undici dispatcher accepted by Node fetch
        dispatcher: this.dispatcher,
      })
    } catch (e) {
      throw new MirthUnreachableError(`Cannot reach ${url}`, e)
    }

    if (resp.status === 401) {
      // Session expired — log in fresh and retry once.
      this.cookieHeader = null
      await this.login()
      headers.Cookie = this.cookieHeader!
      try {
        resp = await fetch(url, {
          method: "GET",
          headers,
          // @ts-expect-error: dispatcher
          dispatcher: this.dispatcher,
        })
      } catch (e) {
        throw new MirthUnreachableError(`Cannot reach ${url}`, e)
      }
      if (resp.status === 401) {
        throw new MirthAuthError(`Mirth rejected session even after re-login`)
      }
    }

    if (!resp.ok) {
      throw new MirthApiError(
        `Mirth ${path} returned ${resp.status}`,
        resp.status,
        await safeReadBody(resp)
      )
    }

    return await resp.text()
  }
}

async function safeReadBody(resp: Response): Promise<string | undefined> {
  try {
    const text = await resp.text()
    return text.slice(0, 2_000) // truncate for log safety
  } catch {
    return undefined
  }
}

// ── Singleton wiring ──────────────────────────────────────────────────────

let clientInstance: MirthClient | null = null

export function getMirthClient(): MirthClient {
  if (clientInstance) return clientInstance
  const env = getEnv()

  let caPem: string | undefined
  if (env.MIRTH_CA_FILE) {
    try {
      caPem = readFileSync(env.MIRTH_CA_FILE, "utf8")
    } catch (e) {
      throw new Error(
        `Could not read MIRTH_CA_FILE=${env.MIRTH_CA_FILE}: ${(e as Error).message}`
      )
    }
  }

  clientInstance = new MirthClient(env.MIRTH_URL, env.MIRTH_USER, env.MIRTH_PASS, {
    caPem,
    insecureSkipVerify: env.MIRTH_INSECURE_SKIP_VERIFY,
  })
  return clientInstance
}

/** For tests — drop the singleton so the next call constructs fresh. */
export function _resetMirthClientForTests(): void {
  clientInstance = null
}
