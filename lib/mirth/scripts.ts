/**
 * Channel-script extraction and patching.
 *
 * Mirth stores executable JavaScript in three places per channel:
 *   1. Channel-level scripts: <preprocessingScript>, <postprocessingScript>,
 *      <deployScript>, <undeployScript> — direct children of <channel>.
 *   2. Source/destination transformers: each <transformer><elements> can
 *      contain N <JavaScriptStep version="...">; each step has a <name>,
 *      <sequenceNumber>, <enabled>, <script> body.
 *   3. Source/destination filters: same shape as transformers but in
 *      <filter><elements> using <com.mirth.connect.plugins.javascriptrule.JavaScriptRule>
 *      elements.
 *
 * We extract those by string-level XML splicing — full DOM parse + re-
 * serialize would corrupt every other field that we shouldn't touch
 * (Mirth's XStream serializer is strict about field ordering, attribute
 * order, and undocumented `version` markers).
 *
 * Round-trip guarantee: patchChannelScripts(getChannelScripts(xml).…, xml)
 * returns byte-identical XML for any channel that has no other changes.
 * Tested in tests/unit/channel-scripts.test.ts.
 */

export const CHANNEL_SCRIPT_KINDS = [
  "preprocessing",
  "postprocessing",
  "deploy",
  "undeploy",
] as const
export type ChannelScriptKind = (typeof CHANNEL_SCRIPT_KINDS)[number]

export interface ConnectorScripts {
  /** Each transformer step ("element") has a name + enabled flag + JS body */
  transformerSteps: ScriptStep[]
  /** Each filter rule has the same shape but represents an accept/reject decision */
  filterRules: ScriptStep[]
}

export interface ScriptStep {
  name: string
  enabled: boolean
  /** 0-based ordering within the parent <elements> block */
  sequenceNumber: number
  /** The JavaScript body, fully un-escaped */
  script: string
}

export interface ChannelScripts {
  channelLevel: Record<ChannelScriptKind, string>
  source: ConnectorScripts
  destinations: Array<{
    metaDataId: number
    name: string
    transformerSteps: ScriptStep[]
    filterRules: ScriptStep[]
    /** Mirth optionally exposes a response transformer per destination */
    responseTransformerSteps: ScriptStep[]
  }>
}

// ── Helpers ────────────────────────────────────────────────────────────

function unescapeXml(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

const CHANNEL_SCRIPT_TAGS: Record<ChannelScriptKind, string> = {
  preprocessing: "preprocessingScript",
  postprocessing: "postprocessingScript",
  deploy: "deployScript",
  undeploy: "undeployScript",
}

function getChannelLevelScript(xml: string, tag: string): string {
  const m = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`).exec(xml)
  return m ? unescapeXml(m[1]) : ""
}

function setChannelLevelScript(xml: string, tag: string, value: string): string {
  const body = escapeXml(value)
  return xml.replace(
    new RegExp(`<${tag}>[\\s\\S]*?</${tag}>`),
    `<${tag}>${body}</${tag}>`
  )
}

// Generic <com.mirth.connect.plugins.javascriptstep.JavaScriptStep ...> parser.
// Returns the inner ScriptStep objects in document order.
const JS_STEP_RE =
  /<com\.mirth\.connect\.plugins\.javascriptstep\.JavaScriptStep[^>]*>([\s\S]*?)<\/com\.mirth\.connect\.plugins\.javascriptstep\.JavaScriptStep>/g

const JS_RULE_RE =
  /<com\.mirth\.connect\.plugins\.javascriptrule\.JavaScriptRule[^>]*>([\s\S]*?)<\/com\.mirth\.connect\.plugins\.javascriptrule\.JavaScriptRule>/g

function parseSteps(elementsBody: string, regex: RegExp): ScriptStep[] {
  const out: ScriptStep[] = []
  let match: RegExpExecArray | null
  // RegExp objects with /g state need resetting before each scan
  regex.lastIndex = 0
  while ((match = regex.exec(elementsBody)) !== null) {
    const inner = match[1]
    const name = /<name>([\s\S]*?)<\/name>/.exec(inner)?.[1] ?? ""
    const seq = parseInt(/<sequenceNumber>(\d+)<\/sequenceNumber>/.exec(inner)?.[1] ?? "0", 10)
    const enabled = /<enabled>true<\/enabled>/.test(inner)
    const script = /<script>([\s\S]*?)<\/script>/.exec(inner)?.[1] ?? ""
    out.push({
      name: unescapeXml(name),
      enabled,
      sequenceNumber: seq,
      script: unescapeXml(script),
    })
  }
  return out
}

function buildSteps(steps: ScriptStep[], elementClass: "step" | "rule"): string {
  if (steps.length === 0) return ""
  const tag =
    elementClass === "step"
      ? "com.mirth.connect.plugins.javascriptstep.JavaScriptStep"
      : "com.mirth.connect.plugins.javascriptrule.JavaScriptRule"
  return (
    "\n" +
    steps
      .map(
        (s, i) =>
          `          <${tag} version="4.5.2">\n` +
          `            <name>${escapeXml(s.name)}</name>\n` +
          `            <sequenceNumber>${s.sequenceNumber || i}</sequenceNumber>\n` +
          `            <enabled>${s.enabled ? "true" : "false"}</enabled>\n` +
          `            <script>${escapeXml(s.script)}</script>\n` +
          `          </${tag}>`
      )
      .join("\n") +
    "\n        "
  )
}

// Splice a new <elements> body into the first <transformer> or <filter>
// block inside a given XML region (source connector or a destination connector).
// We only touch the first matching block per region.
function replaceElementsBlock(
  region: string,
  kind: "transformer" | "filter" | "responseTransformer",
  newSteps: ScriptStep[],
  elementClass: "step" | "rule"
): string {
  // Match <transformer version="..."><elements>...</elements>...</transformer>
  // and replace only the <elements>...</elements> portion.
  const outer = new RegExp(`(<${kind}[^>]*>\\s*<elements)(\\s*/>|>[\\s\\S]*?</elements>)`)
  const m = outer.exec(region)
  if (!m) return region
  const newBody = buildSteps(newSteps, elementClass)
  const replacement = newSteps.length === 0
    ? `${m[1]}/>`
    : `${m[1]}>${newBody}</elements>`
  return region.slice(0, m.index) + replacement + region.slice(m.index + m[0].length)
}

// Split the channel XML into source-region and destinations region so we
// can patch each connector independently without cross-talk.
function splitRegions(xml: string): {
  head: string
  source: string
  destinationsOpen: string
  destinations: { metaDataId: number; xml: string }[]
  tail: string
} {
  const srcStart = xml.indexOf("<sourceConnector")
  const srcEnd = xml.indexOf("</sourceConnector>") + "</sourceConnector>".length
  const destOpen = xml.indexOf("<destinationConnectors>", srcEnd)
  const destClose = xml.indexOf("</destinationConnectors>", destOpen)
  if (srcStart < 0 || srcEnd < 0 || destOpen < 0 || destClose < 0) {
    throw new Error("channel XML is not in the expected shape (source/destinations missing)")
  }
  const head = xml.slice(0, srcStart)
  const source = xml.slice(srcStart, srcEnd)
  const destinationsBody = xml.slice(destOpen + "<destinationConnectors>".length, destClose)
  const tail = xml.slice(destClose)

  const destinations: { metaDataId: number; xml: string }[] = []
  const connectorRe = /<connector[^>]*>[\s\S]*?<\/connector>/g
  let m: RegExpExecArray | null
  while ((m = connectorRe.exec(destinationsBody)) !== null) {
    const metaDataId = parseInt(/<metaDataId>(\d+)<\/metaDataId>/.exec(m[0])?.[1] ?? "1", 10)
    destinations.push({ metaDataId, xml: m[0] })
  }
  return {
    head,
    source,
    destinationsOpen: "<destinationConnectors>",
    destinations,
    tail,
  }
}

// ── Public API ─────────────────────────────────────────────────────────

export function getChannelScripts(xml: string): ChannelScripts {
  const channelLevel: Record<ChannelScriptKind, string> = {
    preprocessing: getChannelLevelScript(xml, "preprocessingScript"),
    postprocessing: getChannelLevelScript(xml, "postprocessingScript"),
    deploy: getChannelLevelScript(xml, "deployScript"),
    undeploy: getChannelLevelScript(xml, "undeployScript"),
  }

  const { source, destinations } = splitRegions(xml)

  // Source connector: one <transformer> + one <filter>
  const srcTrans = /<transformer[^>]*>[\s\S]*?<\/transformer>/.exec(source)?.[0] ?? ""
  const srcFilt = /<filter[^>]*>[\s\S]*?<\/filter>/.exec(source)?.[0] ?? ""

  const sourceScripts: ConnectorScripts = {
    transformerSteps: parseSteps(srcTrans, JS_STEP_RE),
    filterRules: parseSteps(srcFilt, JS_RULE_RE),
  }

  const dests = destinations.map((d) => {
    // A destination has at most one <transformer>, one <responseTransformer>,
    // and one <filter>. Use a non-greedy match scoped to this connector body only.
    const transMatch = /<transformer[^>]*>[\s\S]*?<\/transformer>/.exec(d.xml)?.[0] ?? ""
    const respMatch =
      /<responseTransformer[^>]*>[\s\S]*?<\/responseTransformer>/.exec(d.xml)?.[0] ?? ""
    const filtMatch = /<filter[^>]*>[\s\S]*?<\/filter>/.exec(d.xml)?.[0] ?? ""
    const name = /<connector[^>]*>\s*<metaDataId>\d+<\/metaDataId>\s*<name>([\s\S]*?)<\/name>/.exec(
      d.xml
    )?.[1] ?? ""
    return {
      metaDataId: d.metaDataId,
      name: unescapeXml(name),
      transformerSteps: parseSteps(transMatch, JS_STEP_RE),
      filterRules: parseSteps(filtMatch, JS_RULE_RE),
      responseTransformerSteps: parseSteps(respMatch, JS_STEP_RE),
    }
  })

  return { channelLevel, source: sourceScripts, destinations: dests }
}

export interface ScriptPatch {
  channelLevel?: Partial<Record<ChannelScriptKind, string>>
  source?: Partial<ConnectorScripts>
  destinations?: Array<{
    metaDataId: number
    transformerSteps?: ScriptStep[]
    filterRules?: ScriptStep[]
    responseTransformerSteps?: ScriptStep[]
  }>
}

export function patchChannelScripts(xml: string, patch: ScriptPatch): string {
  let out = xml

  // Channel-level scripts — these are simple text replacements
  if (patch.channelLevel) {
    for (const kind of CHANNEL_SCRIPT_KINDS) {
      const value = patch.channelLevel[kind]
      if (value !== undefined) {
        out = setChannelLevelScript(out, CHANNEL_SCRIPT_TAGS[kind], value)
      }
    }
  }

  // Split off the source connector region, apply patches, splice back
  if (patch.source || patch.destinations) {
    const regions = splitRegions(out)
    let source = regions.source
    if (patch.source?.transformerSteps) {
      source = replaceElementsBlock(source, "transformer", patch.source.transformerSteps, "step")
    }
    if (patch.source?.filterRules) {
      source = replaceElementsBlock(source, "filter", patch.source.filterRules, "rule")
    }

    const newDests = regions.destinations.map((d) => {
      const update = patch.destinations?.find((p) => p.metaDataId === d.metaDataId)
      if (!update) return d.xml
      let dx = d.xml
      if (update.transformerSteps) {
        dx = replaceElementsBlock(dx, "transformer", update.transformerSteps, "step")
      }
      if (update.responseTransformerSteps) {
        dx = replaceElementsBlock(dx, "responseTransformer", update.responseTransformerSteps, "step")
      }
      if (update.filterRules) {
        dx = replaceElementsBlock(dx, "filter", update.filterRules, "rule")
      }
      return dx
    })

    out =
      regions.head +
      source +
      regions.destinationsOpen +
      "\n      " +
      newDests.join("\n      ") +
      "\n    " +
      regions.tail
  }

  return out
}
