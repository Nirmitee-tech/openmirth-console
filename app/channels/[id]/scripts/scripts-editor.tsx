"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { CodeEditor } from "@/components/CodeEditor"
import type {
  ChannelScripts,
  ChannelScriptKind,
  ScriptStep,
} from "@/lib/mirth/scripts"

const CHANNEL_LEVEL_LABELS: Record<ChannelScriptKind, { label: string; sub: string }> = {
  preprocessing: {
    label: "Preprocessor",
    sub: "Runs before any source transformer; useful for sanity-checking or stripping leading whitespace.",
  },
  postprocessing: {
    label: "Postprocessor",
    sub: "Runs after every destination completes; results stored as 'Postprocessor' in the response map.",
  },
  deploy: {
    label: "Deploy script",
    sub: "Runs once when the channel is deployed; access globalMap / globalChannelMap to seed state.",
  },
  undeploy: {
    label: "Undeploy script",
    sub: "Runs once when the channel is undeployed; close connections, flush caches, etc.",
  },
}

type TabId =
  | { kind: "channel"; script: ChannelScriptKind }
  | { kind: "source-transformer" }
  | { kind: "source-filter" }
  | { kind: "dest-transformer"; metaDataId: number }
  | { kind: "dest-response"; metaDataId: number }
  | { kind: "dest-filter"; metaDataId: number }

function tabKey(t: TabId): string {
  switch (t.kind) {
    case "channel":            return `channel:${t.script}`
    case "source-transformer": return "source-transformer"
    case "source-filter":      return "source-filter"
    case "dest-transformer":   return `dest:${t.metaDataId}:transformer`
    case "dest-response":      return `dest:${t.metaDataId}:response`
    case "dest-filter":        return `dest:${t.metaDataId}:filter`
  }
}

interface ScriptsEditorProps {
  channelId: string
  scripts: ChannelScripts
  canEdit: boolean
  csrfToken: string
}

export function ScriptsEditor({ channelId, scripts: initial, canEdit, csrfToken }: ScriptsEditorProps) {
  const router = useRouter()
  const [scripts, setScripts] = useState<ChannelScripts>(initial)
  const [tab, setTab] = useState<TabId>({ kind: "source-transformer" })
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [redeploy, setRedeploy] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [okMessage, setOkMessage] = useState<string | null>(null)

  function setChannelLevel(kind: ChannelScriptKind, value: string) {
    setScripts((prev) => ({
      ...prev,
      channelLevel: { ...prev.channelLevel, [kind]: value },
    }))
    setDirty(true)
  }

  function updateSourceSteps(field: "transformerSteps" | "filterRules", steps: ScriptStep[]) {
    setScripts((prev) => ({ ...prev, source: { ...prev.source, [field]: steps } }))
    setDirty(true)
  }

  function updateDestSteps(
    metaDataId: number,
    field: "transformerSteps" | "filterRules" | "responseTransformerSteps",
    steps: ScriptStep[]
  ) {
    setScripts((prev) => ({
      ...prev,
      destinations: prev.destinations.map((d) =>
        d.metaDataId === metaDataId ? { ...d, [field]: steps } : d
      ),
    }))
    setDirty(true)
  }

  async function save() {
    setSaving(true)
    setError(null)
    setOkMessage(null)
    try {
      const body = {
        csrfToken,
        redeploy,
        channelLevel: scripts.channelLevel,
        source: scripts.source,
        destinations: scripts.destinations.map((d) => ({
          metaDataId: d.metaDataId,
          transformerSteps: d.transformerSteps,
          filterRules: d.filterRules,
          responseTransformerSteps: d.responseTransformerSteps,
        })),
      }
      const res = await fetch(`/api/channels/${encodeURIComponent(channelId)}/scripts`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(err.error ?? `Save failed (${res.status})`)
      }
      setDirty(false)
      setOkMessage(redeploy ? "Saved and redeployed." : "Saved (not redeployed).")
      router.refresh()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg border border-ink-200 p-3 flex flex-wrap items-center gap-3">
        {canEdit ? (
          <>
            <label className="flex items-center gap-2 text-sm text-ink-700">
              <input
                type="checkbox"
                checked={redeploy}
                onChange={(e) => setRedeploy(e.target.checked)}
                className="rounded border-ink-300"
              />
              Redeploy after save
            </label>
            <button
              type="button"
              onClick={save}
              disabled={!dirty || saving}
              className="ml-auto text-sm font-medium px-3 py-1.5 rounded bg-brand-500 hover:bg-brand-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? "Saving…" : dirty ? "Save changes" : "Saved"}
            </button>
          </>
        ) : (
          <span className="text-xs text-ink-600">
            Read-only — operator role required to edit transformers and filters.
          </span>
        )}
      </div>

      {error ? (
        <div className="rounded border border-red-200 bg-red-50 text-red-900 px-3 py-2 text-sm">
          {error}
        </div>
      ) : null}
      {okMessage ? (
        <div className="rounded border border-emerald-200 bg-emerald-50 text-emerald-900 px-3 py-2 text-sm">
          {okMessage}
        </div>
      ) : null}

      <div className="grid lg:grid-cols-[260px_1fr] gap-4">
        {/* Sidebar — navigation across every script slot in the channel */}
        <aside className="bg-white rounded-lg border border-ink-200 p-3 space-y-4 self-start">
          <Group label="Source connector">
            <TabBtn current={tab} self={{ kind: "source-transformer" }} setTab={setTab}>
              Transformer ({scripts.source.transformerSteps.length})
            </TabBtn>
            <TabBtn current={tab} self={{ kind: "source-filter" }} setTab={setTab}>
              Filter ({scripts.source.filterRules.length})
            </TabBtn>
          </Group>

          {scripts.destinations.map((d) => (
            <Group key={d.metaDataId} label={`Destination ${d.metaDataId}: ${d.name || "Unnamed"}`}>
              <TabBtn
                current={tab}
                self={{ kind: "dest-transformer", metaDataId: d.metaDataId }}
                setTab={setTab}
              >
                Transformer ({d.transformerSteps.length})
              </TabBtn>
              <TabBtn
                current={tab}
                self={{ kind: "dest-response", metaDataId: d.metaDataId }}
                setTab={setTab}
              >
                Response transformer ({d.responseTransformerSteps.length})
              </TabBtn>
              <TabBtn
                current={tab}
                self={{ kind: "dest-filter", metaDataId: d.metaDataId }}
                setTab={setTab}
              >
                Filter ({d.filterRules.length})
              </TabBtn>
            </Group>
          ))}

          <Group label="Channel-level scripts">
            {(["preprocessing", "postprocessing", "deploy", "undeploy"] as const).map((s) => (
              <TabBtn key={s} current={tab} self={{ kind: "channel", script: s }} setTab={setTab}>
                {CHANNEL_LEVEL_LABELS[s].label}
              </TabBtn>
            ))}
          </Group>
        </aside>

        {/* Main editor */}
        <div className="space-y-3">
          {tab.kind === "channel" ? (
            <ChannelLevelEditor
              kind={tab.script}
              value={scripts.channelLevel[tab.script]}
              onChange={(v) => setChannelLevel(tab.script, v)}
              readOnly={!canEdit}
            />
          ) : null}

          {tab.kind === "source-transformer" ? (
            <StepListEditor
              kindLabel="Source transformer"
              kindBlurb="Each step runs in order on every received message. Last step's output becomes the channel's working message."
              steps={scripts.source.transformerSteps}
              onChange={(s) => updateSourceSteps("transformerSteps", s)}
              readOnly={!canEdit}
            />
          ) : null}

          {tab.kind === "source-filter" ? (
            <StepListEditor
              kindLabel="Source filter"
              kindBlurb="Each rule should `return true` to accept the message or `return false` to filter it out. Rules are evaluated top-to-bottom; first false rejects."
              steps={scripts.source.filterRules}
              onChange={(s) => updateSourceSteps("filterRules", s)}
              readOnly={!canEdit}
            />
          ) : null}

          {tab.kind === "dest-transformer" ? (
            <StepListEditor
              kindLabel="Destination transformer"
              kindBlurb="Transforms the working message into the body the destination will dispatch (HTTP body, DB params, etc.)."
              steps={
                scripts.destinations.find((d) => d.metaDataId === tab.metaDataId)
                  ?.transformerSteps ?? []
              }
              onChange={(s) => updateDestSteps(tab.metaDataId, "transformerSteps", s)}
              readOnly={!canEdit}
            />
          ) : null}

          {tab.kind === "dest-response" ? (
            <StepListEditor
              kindLabel="Destination response transformer"
              kindBlurb="Runs after the destination receives a response. Use it to parse the response, set channelMap variables for downstream destinations, or raise errors."
              steps={
                scripts.destinations.find((d) => d.metaDataId === tab.metaDataId)
                  ?.responseTransformerSteps ?? []
              }
              onChange={(s) => updateDestSteps(tab.metaDataId, "responseTransformerSteps", s)}
              readOnly={!canEdit}
            />
          ) : null}

          {tab.kind === "dest-filter" ? (
            <StepListEditor
              kindLabel="Destination filter"
              kindBlurb="Controls whether THIS destination handles a message. Useful for fan-out routing (e.g., only send ICU patients to the ICU portal)."
              steps={
                scripts.destinations.find((d) => d.metaDataId === tab.metaDataId)
                  ?.filterRules ?? []
              }
              onChange={(s) => updateDestSteps(tab.metaDataId, "filterRules", s)}
              readOnly={!canEdit}
            />
          ) : null}
        </div>
      </div>

      <div key={tabKey(tab)} />
    </div>
  )
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-ink-600 mb-1">{label}</div>
      <div className="space-y-0.5">{children}</div>
    </div>
  )
}

function TabBtn({
  current,
  self,
  setTab,
  children,
}: {
  current: TabId
  self: TabId
  setTab: (t: TabId) => void
  children: React.ReactNode
}) {
  const active = tabKey(current) === tabKey(self)
  return (
    <button
      type="button"
      onClick={() => setTab(self)}
      className={`w-full text-left text-sm px-2 py-1 rounded ${
        active ? "bg-brand-500 text-white" : "text-ink-700 hover:bg-ink-100"
      }`}
    >
      {children}
    </button>
  )
}

function ChannelLevelEditor({
  kind,
  value,
  onChange,
  readOnly,
}: {
  kind: ChannelScriptKind
  value: string
  onChange: (v: string) => void
  readOnly: boolean
}) {
  const meta = CHANNEL_LEVEL_LABELS[kind]
  return (
    <section>
      <h2 className="text-lg font-semibold text-ink-900">{meta.label}</h2>
      <p className="text-sm text-ink-600 mb-3">{meta.sub}</p>
      <CodeEditor
        value={value}
        onChange={onChange}
        language="javascript"
        readOnly={readOnly}
        minHeight="320px"
      />
    </section>
  )
}

function StepListEditor({
  kindLabel,
  kindBlurb,
  steps,
  onChange,
  readOnly,
}: {
  kindLabel: string
  kindBlurb: string
  steps: ScriptStep[]
  onChange: (s: ScriptStep[]) => void
  readOnly: boolean
}) {
  function update(idx: number, patch: Partial<ScriptStep>) {
    onChange(steps.map((s, i) => (i === idx ? { ...s, ...patch } : s)))
  }
  function remove(idx: number) {
    onChange(steps.filter((_, i) => i !== idx))
  }
  function add() {
    onChange([
      ...steps,
      {
        name: `Step ${steps.length + 1}`,
        enabled: true,
        sequenceNumber: steps.length,
        script: "// Your code here\nreturn message;",
      },
    ])
  }
  function move(idx: number, delta: -1 | 1) {
    const tgt = idx + delta
    if (tgt < 0 || tgt >= steps.length) return
    const next = [...steps]
    const [item] = next.splice(idx, 1)
    next.splice(tgt, 0, item)
    onChange(next.map((s, i) => ({ ...s, sequenceNumber: i })))
  }

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-2">
        <div>
          <h2 className="text-lg font-semibold text-ink-900">{kindLabel}</h2>
          <p className="text-sm text-ink-600 max-w-3xl">{kindBlurb}</p>
        </div>
        {!readOnly ? (
          <button
            type="button"
            onClick={add}
            className="text-sm font-medium px-3 py-1.5 rounded border border-ink-200 bg-white hover:bg-ink-50 text-ink-900"
          >
            + Add step
          </button>
        ) : null}
      </div>
      {steps.length === 0 ? (
        <div className="rounded border border-dashed border-ink-200 bg-white p-8 text-center text-sm text-ink-600">
          No steps yet. {readOnly ? "" : "Click “Add step” to create one."}
        </div>
      ) : (
        <div className="space-y-3">
          {steps.map((s, idx) => (
            <div key={idx} className="bg-white rounded-lg border border-ink-200 p-3 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={s.name}
                  onChange={(e) => update(idx, { name: e.target.value })}
                  placeholder={`Step ${idx + 1}`}
                  readOnly={readOnly}
                  className={`flex-1 min-w-[240px] rounded border border-ink-200 px-2 py-1 text-sm ${readOnly ? "bg-ink-50" : "bg-white"} focus:outline-none focus:ring-1 focus:ring-brand-500`}
                />
                <label className="flex items-center gap-1 text-xs text-ink-700">
                  <input
                    type="checkbox"
                    checked={s.enabled}
                    onChange={(e) => update(idx, { enabled: e.target.checked })}
                    disabled={readOnly}
                  />
                  enabled
                </label>
                {!readOnly ? (
                  <>
                    <button
                      type="button"
                      onClick={() => move(idx, -1)}
                      disabled={idx === 0}
                      className="text-xs text-ink-600 hover:text-ink-900 disabled:opacity-30"
                      title="Move up"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => move(idx, 1)}
                      disabled={idx === steps.length - 1}
                      className="text-xs text-ink-600 hover:text-ink-900 disabled:opacity-30"
                      title="Move down"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(idx)}
                      className="text-xs text-red-600 hover:text-red-800"
                    >
                      Remove
                    </button>
                  </>
                ) : null}
              </div>
              <CodeEditor
                value={s.script}
                onChange={(v) => update(idx, { script: v })}
                language="javascript"
                readOnly={readOnly}
                minHeight="240px"
              />
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
