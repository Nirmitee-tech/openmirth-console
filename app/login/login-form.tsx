"use client"

import { useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"

export function LoginForm({ next }: { next?: string }) {
  const router = useRouter()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [role, setRole] = useState<"viewer" | "operator" | "admin">("operator")
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, role }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error ?? `Sign-in failed (${res.status})`)
      }
      router.push(next && next.startsWith("/") ? next : "/")
      router.refresh()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="bg-white rounded-lg border border-ink-200 shadow-sm p-6 space-y-4"
    >
      {error ? (
        <div className="rounded border border-red-200 bg-red-50 text-red-800 text-sm px-3 py-2">
          {error}
        </div>
      ) : null}
      <div>
        <label htmlFor="username" className="block text-sm font-medium text-ink-800 mb-1">
          Username
        </label>
        <input
          id="username"
          name="username"
          autoComplete="username"
          required
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full rounded border border-ink-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      </div>
      <div>
        <label htmlFor="password" className="block text-sm font-medium text-ink-800 mb-1">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded border border-ink-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      </div>
      <div>
        <label htmlFor="role" className="block text-sm font-medium text-ink-800 mb-1">
          Role
        </label>
        <select
          id="role"
          name="role"
          value={role}
          onChange={(e) => setRole(e.target.value as typeof role)}
          className="w-full rounded border border-ink-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          <option value="viewer">Viewer (read-only)</option>
          <option value="operator">Operator (start/stop, replay)</option>
          <option value="admin">Admin (full)</option>
        </select>
        <p className="mt-1 text-xs text-ink-600">
          In production, swap this form for OIDC group-claim mapping (see ARCHITECTURE.md).
        </p>
      </div>
      <button
        type="submit"
        disabled={submitting}
        className="w-full bg-brand-500 hover:bg-brand-700 text-white font-medium px-4 py-2 rounded disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {submitting ? "Signing in…" : "Sign in"}
      </button>
    </form>
  )
}
