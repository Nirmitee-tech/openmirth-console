import { redirect } from "next/navigation"
import { getSession } from "@/lib/auth/session"
import { LoginForm } from "./login-form"

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>
}) {
  const session = await getSession()
  if (session.username) {
    redirect("/")
  }
  const { next, error } = await searchParams
  return (
    <div className="max-w-md mx-auto mt-12">
      <h1 className="text-2xl font-semibold text-ink-900 dark:text-ink-100 mb-2">Sign in to OpenMirth Console</h1>
      <p className="text-sm text-ink-600 dark:text-ink-400 mb-6">
        Use the credentials configured on your Mirth Connect server. Your role
        is assigned server-side based on the deployment&apos;s role mapping.
      </p>
      <LoginForm next={next} initialError={error ?? null} />
    </div>
  )
}
