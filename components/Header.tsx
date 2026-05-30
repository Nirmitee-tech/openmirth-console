import Link from "next/link"
import { getMirthClient } from "@/lib/mirth/client"
import { getEnv } from "@/lib/env"
import { ThemeToggle } from "./ThemeToggle"

interface HeaderProps {
  username?: string
  role?: string
}

/** Server component — pre-fetches Mirth version + URL for the context chip. */
export async function Header({ username, role }: HeaderProps) {
  const env = getEnv()
  let mirthVersion: string | null = null
  try {
    mirthVersion = await getMirthClient().serverVersion()
  } catch {
    mirthVersion = null
  }
  // Friendly server label: host[:port] of the configured Mirth URL.
  let serverLabel = env.MIRTH_URL
  try {
    serverLabel = new URL(env.MIRTH_URL).host
  } catch {
    /* keep raw */
  }

  return (
    <header className="bg-brand-900 text-white border-b-4 border-accent-amber sticky top-0 z-30">
      <div className="px-5 h-14 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/" className="flex items-center gap-2 flex-shrink-0">
            <span className="text-base font-semibold tracking-tight">OpenMirth Console</span>
            <span className="text-[10px] uppercase tracking-wider text-accent-amber bg-brand-700 px-1.5 py-0.5 rounded">
              v0.1
            </span>
          </Link>
          <Chip label="ENV" value={env.NODE_ENV.toUpperCase()} />
          <Chip
            label="MIRTH"
            value={mirthVersion ? `v${mirthVersion}` : "unreachable"}
            ok={mirthVersion !== null}
          />
          <Chip label="SERVER" value={serverLabel} mono />
        </div>
        <div className="flex items-center gap-3 text-sm">
          <ThemeToggle />
          {username ? (
            <>
              <span className="text-white/80">
                {username}
                {role ? (
                  <span className="ml-2 text-[10px] uppercase tracking-wide bg-brand-700 px-1.5 py-0.5 rounded">
                    {role}
                  </span>
                ) : null}
              </span>
              <form action="/api/auth/logout" method="post">
                <button
                  type="submit"
                  className="text-white/70 hover:text-white text-xs underline underline-offset-4"
                >
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <Link href="/login" className="text-white/80 hover:text-white">
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}

function Chip({
  label,
  value,
  ok,
  mono = false,
}: {
  label: string
  value: string
  ok?: boolean
  mono?: boolean
}) {
  const dot =
    ok === undefined ? null : (
      <span
        className={`inline-block w-1.5 h-1.5 rounded-full ${ok ? "bg-emerald-400" : "bg-red-400"}`}
      />
    )
  return (
    <div className="hidden md:flex items-center gap-1.5 px-2 py-0.5 rounded bg-brand-700/60 text-[11px]">
      <span className="text-white/60 uppercase tracking-wider">{label}</span>
      {dot}
      <span className={`text-white truncate max-w-[200px] ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  )
}
