/**
 * Minimal RFC 4180 CSV writer — Excel opens this with a double-click.
 *
 * No external dependency. Handles:
 *   - quoting cells containing comma, quote, newline, or CR
 *   - escaping internal quotes by doubling
 *   - UTF-8 BOM prefix so Excel detects encoding correctly (especially
 *     important for international hospital names)
 *   - trailing CRLF per RFC 4180
 *
 * For native .xlsx, post-process with a worker — the trade-off is the
 * server-side dependency footprint (xlsx-style libs are 1+ MB).
 */
export interface CsvColumn<T> {
  header: string
  /** Cell extractor — return any scalar; we coerce to string. */
  get: (row: T) => string | number | boolean | null | undefined
}

const NEEDS_QUOTE = /[",\r\n]/

function quote(v: string | number | boolean | null | undefined): string {
  if (v === null || v === undefined) return ""
  const s = String(v)
  if (!NEEDS_QUOTE.test(s)) return s
  return `"${s.replace(/"/g, '""')}"`
}

export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const out: string[] = []
  out.push(columns.map((c) => quote(c.header)).join(","))
  for (const row of rows) {
    out.push(columns.map((c) => quote(c.get(row))).join(","))
  }
  // UTF-8 BOM so Excel auto-detects encoding
  return "﻿" + out.join("\r\n") + "\r\n"
}

/** Build a downloadable Response from CSV content. */
export function csvResponse(filename: string, csv: string): Response {
  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename.replace(/"/g, "")}"`,
      "Cache-Control": "no-store",
    },
  })
}
