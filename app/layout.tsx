import type { Metadata, Viewport } from "next"
import Script from "next/script"
import "./globals.css"
import { Header } from "@/components/Header"
import { Sidebar } from "@/components/Sidebar"
import { Footer } from "@/components/Footer"
import { getSession } from "@/lib/auth/session"

export const metadata: Metadata = {
  title: "OpenMirth Console",
  description:
    "Open-source operations layer for Mirth Connect and OIE — modern admin, clinical observability, channel CI/CD.",
  applicationName: "OpenMirth Console",
  authors: [{ name: "Nirmitee.io", url: "https://nirmitee.io" }],
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0b2545",
}

// Pre-paint dark-mode so there's no flash. This runs before React hydrates.
const THEME_PREPAINT = `
(function() {
  try {
    var stored = localStorage.getItem('omcc-theme');
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var mode = stored || (prefersDark ? 'dark' : 'light');
    if (mode === 'dark') document.documentElement.classList.add('dark');
  } catch (e) {}
})();
`

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  const showShell = Boolean(session.username)
  return (
    <html lang="en">
      <head>
        <Script id="theme-prepaint" strategy="beforeInteractive">
          {THEME_PREPAINT}
        </Script>
      </head>
      <body>
        {showShell ? (
          <div className="min-h-screen flex flex-col bg-ink-50 dark:bg-ink-800 dark:bg-ink-900">
            <Header username={session.username} role={session.role} />
            <div className="flex flex-1 min-h-0">
              <Sidebar />
              <main className="flex-1 overflow-x-auto px-6 py-6 max-w-full">
                {children}
              </main>
            </div>
            <Footer />
          </div>
        ) : (
          <div className="min-h-screen flex flex-col bg-ink-50 dark:bg-ink-800 dark:bg-ink-900">
            <Header />
            <main className="flex-1 px-6 py-6 max-w-7xl mx-auto w-full">{children}</main>
            <Footer />
          </div>
        )}
      </body>
    </html>
  )
}
