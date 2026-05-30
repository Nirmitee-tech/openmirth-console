import Link from "next/link"

interface HeaderProps {
  username?: string
  role?: string
}

export function Header({ username, role }: HeaderProps) {
  return (
    <header className="bg-brand-900 text-white border-b-4 border-accent-amber">
      <div className="mx-auto max-w-7xl px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-lg font-semibold tracking-tight">OpenMirth Console</span>
            <span className="text-xs uppercase tracking-wider text-accent-amber bg-brand-700 px-2 py-0.5 rounded">
              v0.1
            </span>
          </Link>
          <nav className="hidden md:flex items-center gap-1 text-sm">
            <NavLink href="/">Dashboard</NavLink>
            <NavLink href="/channels">Channels</NavLink>
            <NavLink href="/catalog">Catalog</NavLink>
            <NavLink href="/observability">Observability</NavLink>
          </nav>
        </div>
        <div className="flex items-center gap-3 text-sm">
          {username ? (
            <>
              <span className="text-white/80">
                {username}
                {role ? (
                  <span className="ml-2 text-xs uppercase tracking-wide bg-brand-700 px-1.5 py-0.5 rounded">
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

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="px-3 py-1.5 rounded hover:bg-brand-700 text-white/85 hover:text-white transition-colors"
    >
      {children}
    </Link>
  )
}
