"use client"

import { useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"

interface LoginFormProps {
  next?: string
  initialError?: string | null
}

const ERROR_MESSAGES: Record<string, string> = {
  invalid_credentials: "Invalid username or password.",
  no_role: "Your account is not authorized for this console. Contact your administrator.",
  mirth_unreachable: "Mirth Connect is currently unreachable. Please try again in a moment.",
}

function safeNextPath(value: string | undefined): string {
  if (!value) return "/"
  if (!value.startsWith("/")) return "/"
  if (value.startsWith("//") || value.startsWith("/\\")) return "/"
  return value
}

export function LoginForm({ next, initialError }: LoginFormProps) {
  const router = useRouter()
  const safeNext = safeNextPath(next)
  const [error, setError] = useState<string | null>(
    initialError && ERROR_MESSAGES[initialError]
      ? ERROR_MESSAGES[initialError]
      : initialError
        ? "Unable to sign in. Please try again."
        : null
  )
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    const form = e.currentTarget
    const formData = new FormData(form)
    const username = String(formData.get("username") ?? "")
    const password = String(formData.get("password") ?? "")

    try {
      const res = await fetch(
        `/api/auth/login${safeNext !== "/" ? `?next=${encodeURIComponent(safeNext)}` : ""}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({ username, password }),
        }
      )
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error ?? `Sign-in failed (${res.status})`)
      }
      router.push(safeNext)
      router.refresh()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  // method="post" + action ensures the form works WITHOUT JS too:
  // the browser submits form-encoded to /api/auth/login which handles
  // both content types and responds with a redirect.
  const action =
    safeNext !== "/"
      ? `/api/auth/login?next=${encodeURIComponent(safeNext)}`
      : "/api/auth/login"

  return (
    <form
      method="post"
      action={action}
      onSubmit={onSubmit}
      className="bg-white dark:bg-ink-800 rounded-lg border border-ink-200 dark:border-ink-700 shadow-sm p-6 space-y-4"
    >
      {error ? (
        <div className="rounded border border-red-200 bg-red-50 text-red-800 text-sm px-3 py-2">
          {error}
        </div>
      ) : null}
      <div>
        <label htmlFor="username" className="block text-sm font-medium text-ink-800 dark:text-ink-200 mb-1">
          Username
        </label>
        <input
          id="username"
          name="username"
          autoComplete="username"
          required
          autoFocus
          className="w-full rounded border border-ink-200 dark:border-ink-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      </div>
      <div>
        <label htmlFor="password" className="block text-sm font-medium text-ink-800 dark:text-ink-200 mb-1">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="w-full rounded border border-ink-200 dark:border-ink-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      </div>
      <button
        type="submit"
        disabled={submitting}
        className="w-full bg-brand-500 hover:bg-brand-700 text-white font-medium px-4 py-2 rounded disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {submitting ? "Signing in…" : "Sign in"}
      </button>
      <p className="text-xs text-ink-600 dark:text-ink-400 pt-2 border-t border-ink-100 dark:border-ink-800">
        Your role is assigned by your administrator. Configure role membership
        on the server via the <code>OMCC_ROLE_ADMIN</code>,{" "}
        <code>OMCC_ROLE_OPERATOR</code>, and <code>OMCC_ROLE_VIEWER</code> env
        vars — see the deployment docs.
      </p>
    </form>
  )
}
