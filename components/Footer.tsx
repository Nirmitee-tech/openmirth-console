import Link from "next/link"

/**
 * Footer with attribution and support links to Nirmitee.
 *
 * Placement: bottom of every page. Tasteful, useful (the support link
 * leads to actual help) — NOT advertising. The build attribution is
 * a one-line credit common to open-source projects.
 */
export function Footer() {
  return (
    <footer className="border-t border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-800">
      <div className="mx-auto max-w-7xl px-6 py-6 flex flex-col md:flex-row items-center justify-between gap-3 text-sm text-ink-600 dark:text-ink-400">
        <div>
          <span>OpenMirth Console</span>
          <span className="mx-2 text-ink-400 dark:text-ink-500">·</span>
          <Link
            href="https://github.com/Nirmitee-tech/openmirth-console"
            target="_blank"
            rel="noreferrer noopener"
            className="hover:text-brand-500 underline-offset-4 hover:underline"
          >
            GitHub
          </Link>
          <span className="mx-2 text-ink-400 dark:text-ink-500">·</span>
          <Link href="/about" className="hover:text-brand-500">
            About
          </Link>
        </div>
        <div className="flex items-center gap-4">
          <span>
            Built and maintained by{" "}
            <Link
              href="https://nirmitee.io?utm_source=openmirth-console&utm_medium=footer"
              target="_blank"
              rel="noreferrer noopener"
              className="font-medium text-brand-500 hover:underline underline-offset-4"
            >
              Nirmitee.io
            </Link>
          </span>
          <Link
            href="https://nirmitee.io/get-in-touch?utm_source=openmirth-console&utm_medium=footer-support"
            target="_blank"
            rel="noreferrer noopener"
            className="text-ink-600 dark:text-ink-400 hover:text-brand-500 underline-offset-4 hover:underline"
          >
            Need Mirth Connect support?
          </Link>
        </div>
      </div>
    </footer>
  )
}
