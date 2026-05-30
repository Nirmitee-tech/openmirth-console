import { redirect } from "next/navigation"
import { getSession } from "@/lib/auth/session"
import { LoginForm } from "./login-form"

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const session = await getSession()
  if (session.username) {
    redirect("/")
  }
  const { next } = await searchParams
  return (
    <div className="max-w-md mx-auto mt-12">
      <h1 className="text-2xl font-semibold text-ink-900 mb-2">Sign in to OpenMirth Console</h1>
      <p className="text-sm text-ink-600 mb-6">
        Use the same credentials configured on your Mirth Connect server. Your role
        determines which actions you can take.
      </p>
      <LoginForm next={next} />
    </div>
  )
}
