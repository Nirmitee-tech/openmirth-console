/**
 * Parse Mirth's GET /api/channels/{id}/messages?includeContent=true response.
 *
 * The XML shape is verbose — what the UI actually needs is a flat list of
 * (messageId, receivedAt, status, connectors[]) where each connector has
 * its raw/transformed/encoded/response payloads + status code.
 *
 * Content payloads can be huge (multi-MB FHIR Bundles); we trim each at a
 * 200 KB ceiling so the UI doesn't OOM on a single message browse. The
 * full content is still recoverable via the raw Mirth REST API.
 */
const MAX_PAYLOAD_BYTES = 200_000

export type ConnectorStatus =
  | "RECEIVED"
  | "FILTERED"
  | "TRANSFORMED"
  | "SENT"
  | "QUEUED"
  | "ERROR"
  | "PENDING"
  | "DELAYED"
  | "UNKNOWN"

export interface ConnectorPayload {
  metaDataId: number
  connectorName: string
  status: ConnectorStatus
  raw: string | null
  transformed: string | null
  encoded: string | null
  response: string | null
  /** True if any payload was trimmed for size */
  truncated: boolean
}

export interface MirthMessage {
  messageId: string
  receivedAt: number  // epoch ms
  processed: boolean
  connectors: ConnectorPayload[]
}

function unescapeXml(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&#xd;/g, "\r")
    .replace(/&#xa;/g, "\n")
    .replace(/&amp;/g, "&")
}

function trim(s: string | null): { value: string | null; truncated: boolean } {
  if (s === null) return { value: null, truncated: false }
  if (s.length <= MAX_PAYLOAD_BYTES) return { value: s, truncated: false }
  return { value: s.slice(0, MAX_PAYLOAD_BYTES) + "\n…(truncated)", truncated: true }
}

function statusOf(value: string | undefined): ConnectorStatus {
  const KNOWN: ConnectorStatus[] = [
    "RECEIVED", "FILTERED", "TRANSFORMED", "SENT",
    "QUEUED", "ERROR", "PENDING", "DELAYED",
  ]
  if (value && (KNOWN as string[]).includes(value)) return value as ConnectorStatus
  return "UNKNOWN"
}

function extractContent(connectorXml: string, tag: string): string | null {
  // Non-greedy match for <{tag}>...<content>...</content>...</{tag}>
  const re = new RegExp(`<${tag}>[\\s\\S]*?<content>([\\s\\S]*?)<\\/content>[\\s\\S]*?<\\/${tag}>`)
  const m = re.exec(connectorXml)
  return m ? unescapeXml(m[1]) : null
}

export function parseMessages(xml: string): MirthMessage[] {
  const out: MirthMessage[] = []
  const msgRe = /<message>([\s\S]*?)<\/message>/g
  let mm: RegExpExecArray | null
  while ((mm = msgRe.exec(xml)) !== null) {
    const body = mm[1]
    const messageId =
      /<messageId>(\d+)<\/messageId>/.exec(body)?.[1] ?? "?"
    const receivedAt = parseInt(
      /<receivedDate>\s*<time>(\d+)<\/time>/.exec(body)?.[1] ?? "0",
      10
    )
    const processed = /<processed>true<\/processed>/.test(body)

    const connectors: ConnectorPayload[] = []
    const cmRe = /<connectorMessage>([\s\S]*?)<\/connectorMessage>/g
    let cm: RegExpExecArray | null
    while ((cm = cmRe.exec(body)) !== null) {
      const cmx = cm[1]
      const metaDataId = parseInt(
        /<metaDataId>(\d+)<\/metaDataId>/.exec(cmx)?.[1] ?? "0",
        10
      )
      const connectorName = unescapeXml(
        /<connectorName>([\s\S]*?)<\/connectorName>/.exec(cmx)?.[1] ?? ""
      )
      const status = statusOf(/<status>([A-Z]+)<\/status>/.exec(cmx)?.[1])

      const raw = trim(extractContent(cmx, "raw"))
      const transformed = trim(extractContent(cmx, "transformed"))
      const encoded = trim(extractContent(cmx, "encoded"))
      const response = trim(extractContent(cmx, "response"))

      connectors.push({
        metaDataId,
        connectorName,
        status,
        raw: raw.value,
        transformed: transformed.value,
        encoded: encoded.value,
        response: response.value,
        truncated:
          raw.truncated || transformed.truncated || encoded.truncated || response.truncated,
      })
    }
    connectors.sort((a, b) => a.metaDataId - b.metaDataId)

    out.push({ messageId, receivedAt, processed, connectors })
  }
  return out
}
