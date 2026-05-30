"use client"

import { useEffect, useState } from "react"

const STORAGE_KEY = "omcc-theme"

/**
 * Simple light/dark/system theme toggle.
 *
 * Tailwind is configured with `darkMode: 'class'` so we just toggle the
 * `dark` class on <html>. The choice is persisted in localStorage; on
 * first paint we honor prefers-color-scheme.
 */
export function ThemeToggle() {
  const [mode, setMode] = useState<"light" | "dark" | null>(null)

  useEffect(() => {
    const saved = (typeof localStorage !== "undefined" && localStorage.getItem(STORAGE_KEY)) as
      | "light"
      | "dark"
      | null
    const initial =
      saved ??
      (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
    setMode(initial)
    applyMode(initial)
  }, [])

  function flip() {
    const next = mode === "dark" ? "light" : "dark"
    setMode(next)
    applyMode(next)
    if (typeof localStorage !== "undefined") localStorage.setItem(STORAGE_KEY, next)
  }

  if (!mode) return null
  return (
    <button
      type="button"
      onClick={flip}
      aria-label={`Switch to ${mode === "dark" ? "light" : "dark"} mode`}
      title={`Switch to ${mode === "dark" ? "light" : "dark"} mode`}
      className="text-white/80 hover:text-white text-base px-2 py-1 rounded hover:bg-brand-700"
    >
      {mode === "dark" ? "☀" : "☾"}
    </button>
  )
}

function applyMode(mode: "light" | "dark"): void {
  if (typeof document === "undefined") return
  const html = document.documentElement
  if (mode === "dark") html.classList.add("dark")
  else html.classList.remove("dark")
}
