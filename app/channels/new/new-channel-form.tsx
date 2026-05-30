"use client"

import { useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import type { ChannelTemplateId } from "@/lib/mirth/templates"

interface TemplateMeta {
  id: ChannelTemplateId
  title: string
  subtitle: string
  bestFor: string
}

interface NewChannelFormProps {
  templates: TemplateMeta[]
  csrfToken: string
  existingChannels: { id: string; name: string }[]
}

export function NewChannelForm({ templates, csrfToken, existingChannels }: NewChannelFormProps) {
  const router = useRouter()
  const [picked, setPicked] = useState<ChannelTemplateId>(templates[0].id)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [port, setPort] = useState<number | "">("")
  const [contextPath, setContextPath] = useState("/inbound")
  const [target, setTarget] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const needsPort = picked === "mllp-passthrough" || picked === "http-passthrough"
  const needsPath = picked === "http-passthrough"
  const allowsTarget = picked === "mllp-passthrough" || picked === "channel-writer"

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!name.trim()) {
      setError("Name is required.")
      return
    }
    if (needsPort && (typeof port !== "number" || port < 1)) {
      setError("Port must be a number between 1 and 65535.")
      return
    }
    setSubmitting(true)
    try {
      const payload = {
        template: {
          template: picked,
          name: name.trim(),
          description: description.trim(),
          port: needsPort ? Number(port) : undefined,
          contextPath: needsPath ? contextPath : undefined,
          targetChannelId: allowsTarget && target ? target : undefined,
        },
        csrfToken,
      }
      const res = await fetch("/api/channels/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error ?? `Creation failed (${res.status})`)
      }
      const body = (await res.json()) as { id: string }
      router.push(`/channels/${body.id}`)
      router.refresh()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-600 dark:text-ink-400 mb-3">
          1. Pick a template
        </h2>
        <div className="grid md:grid-cols-3 gap-3">
          {templates.map((t) => {
            const active = picked === t.id
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setPicked(t.id)}
                className={`text-left p-4 rounded border transition-colors ${
                  active
                    ? "border-brand-500 bg-brand-50 ring-2 ring-brand-500"
                    : "border-ink-200 bg-white hover:border-brand-500/50"
                }`}
              >
                <div className="font-semibold text-ink-900 dark:text-ink-100">{t.title}</div>
                <div className="mt-1 text-xs text-ink-600 dark:text-ink-400">{t.subtitle}</div>
                <div className="mt-2 text-xs">
                  <span className="text-ink-600 dark:text-ink-400">Best for: </span>
                  <span className="text-ink-800 dark:text-ink-200">{t.bestFor}</span>
                </div>
              </button>
            )
          })}
        </div>
      </section>

      <section className="bg-white dark:bg-ink-800 rounded-lg border border-ink-200 dark:border-ink-700 p-6 space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-600 dark:text-ink-400">
          2. Configure
        </h2>

        <Field label="Channel name" required>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="e.g. Lab Results (ORU) Listener"
            className="w-full rounded border border-ink-200 dark:border-ink-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </Field>

        <Field label="Description">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="Short description shown in the channel list."
            className="w-full rounded border border-ink-200 dark:border-ink-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </Field>

        {needsPort ? (
          <Field label={picked === "mllp-passthrough" ? "MLLP listener port" : "HTTP listener port"} required>
            <input
              type="number"
              min={1}
              max={65535}
              value={port}
              onChange={(e) => setPort(e.target.value === "" ? "" : Number(e.target.value))}
              required
              placeholder={picked === "mllp-passthrough" ? "6661" : "8081"}
              className="w-32 rounded border border-ink-200 dark:border-ink-700 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </Field>
        ) : null}

        {needsPath ? (
          <Field label="HTTP context path" required>
            <input
              value={contextPath}
              onChange={(e) => setContextPath(e.target.value)}
              required
              placeholder="/inbound"
              className="w-64 rounded border border-ink-200 dark:border-ink-700 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </Field>
        ) : null}

        {allowsTarget ? (
          <Field label="Dispatch to channel (optional)">
            <select
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className="w-full rounded border border-ink-200 dark:border-ink-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="">— Don&apos;t dispatch (drop after receive) —</option>
              {existingChannels.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-ink-600 dark:text-ink-400 mt-1">
              Adds a Channel Writer destination pointing at the selected target channel.
            </p>
          </Field>
        ) : null}
      </section>

      {error ? (
        <div className="rounded border border-red-200 bg-red-50 text-red-900 px-3 py-2 text-sm">
          {error}
        </div>
      ) : null}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="bg-brand-500 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2 rounded disabled:opacity-60"
        >
          {submitting ? "Creating…" : "Create + Deploy"}
        </button>
        <span className="text-xs text-ink-600 dark:text-ink-400">
          The channel will be imported, enabled, and deployed in one shot.
        </span>
      </div>
    </form>
  )
}

function Field({
  label,
  required,
  children,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-ink-800 dark:text-ink-200 mb-1">
        {label}
        {required ? <span className="text-red-600 ml-0.5">*</span> : null}
      </span>
      {children}
    </label>
  )
}
