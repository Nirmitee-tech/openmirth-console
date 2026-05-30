"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"

interface NavItem {
  label: string
  href: string
  /** Optional inline icon (one-char emoji or short SVG). Keep it small. */
  icon?: string
}

interface NavGroup {
  label: string
  items: NavItem[]
}

const GROUPS: NavGroup[] = [
  {
    label: "Mirth",
    items: [
      { label: "Channels",    href: "/channels",       icon: "▸" },
      { label: "New channel", href: "/channels/new",   icon: "+" },
      { label: "Mappings",    href: "/mappings",       icon: "↻" },
    ],
  },
  {
    label: "Monitoring",
    items: [
      { label: "Dashboard",      href: "/",               icon: "■" },
      { label: "Observability",  href: "/observability",  icon: "≈" },
    ],
  },
  {
    label: "System",
    items: [
      { label: "Health",   href: "/system/health", icon: "♥" },
      { label: "Logs",     href: "/system/logs",   icon: "≡" },
      { label: "Catalog",  href: "/catalog",       icon: "□" },
    ],
  },
  {
    label: "About",
    items: [
      { label: "About this console", href: "/about", icon: "ⓘ" },
    ],
  },
]

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/"
  return pathname === href || pathname.startsWith(href + "/")
}

export function Sidebar({ collapsed = false }: { collapsed?: boolean }) {
  const pathname = usePathname() ?? "/"
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(
    Object.fromEntries(GROUPS.map((g) => [g.label, true]))
  )
  function toggle(label: string) {
    setOpenGroups((p) => ({ ...p, [label]: !p[label] }))
  }

  return (
    <nav
      className={`bg-white dark:bg-ink-900 border-r border-ink-200 dark:border-ink-800 flex-shrink-0 ${
        collapsed ? "w-14" : "w-60"
      } transition-all duration-150 overflow-y-auto`}
      aria-label="Primary navigation"
    >
      <ul className="py-3 px-2 space-y-3">
        {GROUPS.map((group) => (
          <li key={group.label}>
            {!collapsed ? (
              <button
                type="button"
                onClick={() => toggle(group.label)}
                className="w-full flex items-center justify-between px-2 py-1 text-[10px] uppercase tracking-wider font-semibold text-ink-600 dark:text-ink-400 hover:text-ink-900 dark:hover:text-ink-100"
              >
                <span>{group.label}</span>
                <span className="text-xs">{openGroups[group.label] ? "▾" : "▸"}</span>
              </button>
            ) : null}
            {(collapsed || openGroups[group.label]) ? (
              <ul className="mt-1 space-y-0.5">
                {group.items.map((item) => {
                  const active = isActive(pathname, item.href)
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        title={collapsed ? item.label : undefined}
                        className={`flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors ${
                          active
                            ? "bg-brand-500 text-white"
                            : "text-ink-700 dark:text-ink-200 hover:bg-ink-100 dark:hover:bg-ink-800"
                        }`}
                      >
                        <span
                          className={`inline-block w-4 text-center text-xs ${
                            active ? "text-white" : "text-ink-400"
                          }`}
                        >
                          {item.icon ?? "·"}
                        </span>
                        {!collapsed ? <span className="truncate">{item.label}</span> : null}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            ) : null}
          </li>
        ))}
      </ul>
    </nav>
  )
}
