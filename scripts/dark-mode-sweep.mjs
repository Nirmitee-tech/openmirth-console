#!/usr/bin/env node
/**
 * Sweep app/ + components/ and add Tailwind `dark:` variants for the
 * common color classes that are missing one.
 *
 * Idempotent: for each `class` token, if a corresponding `dark:` partner
 * is already present anywhere in the same className string, we leave it
 * alone. Otherwise we splice the partner in right after the original.
 *
 * Examples:
 *   "bg-white"        → "bg-white dark:bg-ink-800"
 *   "text-ink-600"    → "text-ink-600 dark:text-ink-400"
 *   "border-ink-200"  → "border-ink-200 dark:border-ink-700"
 *
 * Run:  node scripts/dark-mode-sweep.mjs
 */
import { readdir, readFile, writeFile, stat } from "node:fs/promises"
import { join } from "node:path"

const ROOTS = ["app", "components"]
const EXTS = new Set([".tsx", ".ts", ".jsx", ".js", ".css"])

// Each entry: [pattern matcher, dark variant to splice in]
// Patterns are matched against single token (no whitespace) inside className.
const RULES = [
  // Backgrounds
  [/^bg-white$/,            "dark:bg-ink-800"],
  [/^bg-ink-50$/,           "dark:bg-ink-800"],
  [/^bg-ink-100$/,          "dark:bg-ink-700"],
  [/^bg-ink-200$/,          "dark:bg-ink-700"],

  // Hovers
  [/^hover:bg-ink-50$/,     "dark:hover:bg-ink-700"],
  [/^hover:bg-ink-100$/,    "dark:hover:bg-ink-700"],
  [/^hover:bg-ink-200$/,    "dark:hover:bg-ink-700"],

  // Borders
  [/^border-ink-100$/,      "dark:border-ink-800"],
  [/^border-ink-200$/,      "dark:border-ink-700"],
  [/^border-ink-300$/,      "dark:border-ink-700"],

  // Text — invert tone for readability
  [/^text-ink-900$/,        "dark:text-ink-100"],
  [/^text-ink-800$/,        "dark:text-ink-200"],
  [/^text-ink-700$/,        "dark:text-ink-300"],
  [/^text-ink-600$/,        "dark:text-ink-400"],
  [/^text-ink-500$/,        "dark:text-ink-500"],
  [/^text-ink-400$/,        "dark:text-ink-500"],

  // Hover text
  [/^hover:text-ink-900$/,  "dark:hover:text-ink-100"],
  [/^hover:text-ink-800$/,  "dark:hover:text-ink-200"],
  [/^hover:text-ink-700$/,  "dark:hover:text-ink-300"],

  // Divides
  [/^divide-ink-100$/,      "dark:divide-ink-800"],
  [/^divide-ink-200$/,      "dark:divide-ink-700"],
]

/**
 * Process a className string. Splits on whitespace, walks tokens, and
 * appends the dark variant only when:
 *   - the token matches a rule's pattern
 *   - the matching dark variant isn't already present in the className
 */
function transformClassName(value) {
  // Quick exit if there's no `dark` mention AND no matchable token
  if (!RULES.some(([re]) => value.split(/\s+/).some((t) => re.test(t)))) {
    return value
  }
  const tokens = value.split(/(\s+)/) // keep whitespace runs as separators
  const present = new Set(tokens.map((t) => t.trim()).filter(Boolean))
  const out = []
  for (const t of tokens) {
    out.push(t)
    if (!t.trim()) continue
    for (const [re, dark] of RULES) {
      if (re.test(t) && !present.has(dark)) {
        out.push(" " + dark)
        present.add(dark)
      }
    }
  }
  return out.join("")
}

// Match className="..." OR className={`...`} OR className={'...'}
// We only touch the literal string portions; template-string interpolations
// passed through with the static segments transformed individually.
const CLASSNAME_DOUBLE = /className=("([^"]*)")/g
const CLASSNAME_SINGLE = /className=('([^']*)')/g
const CLASSNAME_TEMPLATE = /className=\{`([^`]*)`\}/g

let touched = 0

async function processFile(path) {
  const original = await readFile(path, "utf8")
  let next = original

  next = next.replace(CLASSNAME_DOUBLE, (_m, _all, inner) =>
    `className="${transformClassName(inner)}"`
  )
  next = next.replace(CLASSNAME_SINGLE, (_m, _all, inner) =>
    `className='${transformClassName(inner)}'`
  )
  next = next.replace(CLASSNAME_TEMPLATE, (_m, inner) => {
    // For template strings, only transform the static text spans.
    // Split on ${...} expressions, transform each static piece.
    const parts = inner.split(/(\$\{[\s\S]*?\})/g)
    const transformed = parts.map((p) =>
      p.startsWith("${") ? p : transformClassName(p)
    )
    return "className={`" + transformed.join("") + "`}"
  })

  if (next !== original) {
    await writeFile(path, next)
    touched++
    console.log("touched", path)
  }
}

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  for (const e of entries) {
    const p = join(dir, e.name)
    if (e.isDirectory()) {
      if (e.name === "node_modules" || e.name.startsWith(".")) continue
      await walk(p)
    } else if (e.isFile()) {
      const ext = "." + e.name.split(".").pop()
      if (EXTS.has(ext)) await processFile(p)
    }
  }
}

for (const root of ROOTS) {
  try {
    const s = await stat(root)
    if (s.isDirectory()) await walk(root)
  } catch (e) {
    console.warn("skip", root, e.message)
  }
}
console.log(`Done. ${touched} files touched.`)
