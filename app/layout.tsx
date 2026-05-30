import type { Metadata, Viewport } from "next"
import "./globals.css"
import { Header } from "@/components/Header"
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

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  return (
    <html lang="en">
      <body>
        <div className="min-h-screen flex flex-col">
          <Header username={session.username} role={session.role} />
          <main className="flex-1 mx-auto max-w-7xl w-full px-6 py-8">{children}</main>
          <Footer />
        </div>
      </body>
    </html>
  )
}
