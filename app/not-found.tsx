import Link from "next/link"

export default function NotFound() {
  return (
    <div className="max-w-md mx-auto mt-16 text-center">
      <p className="text-sm font-semibold text-brand-500">404</p>
      <h1 className="text-2xl font-semibold text-ink-900 dark:text-ink-100 mt-2">Page not found</h1>
      <p className="text-sm text-ink-600 dark:text-ink-400 mt-2">
        The page or channel you&apos;re looking for doesn&apos;t exist.
      </p>
      <Link
        href="/"
        className="inline-block mt-6 text-sm text-brand-500 hover:underline underline-offset-4"
      >
        ← Back to Dashboard
      </Link>
    </div>
  )
}
