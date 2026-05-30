import { describe, expect, it } from "vitest"
import { toCsv } from "@/lib/csv"

describe("toCsv", () => {
  const rows = [
    { name: "Alice", age: 30, note: "" },
    { name: "Bob, Jr.", age: 0, note: 'He said "hi"' },
    { name: "Multi\nLine", age: -1, note: null },
  ]
  const cols = [
    { header: "Name", get: (r: (typeof rows)[number]) => r.name },
    { header: "Age", get: (r: (typeof rows)[number]) => r.age },
    { header: "Note", get: (r: (typeof rows)[number]) => r.note },
  ]

  it("emits headers + rows separated by CRLF", () => {
    const csv = toCsv(rows, cols)
    const lines = csv.replace(/^﻿/, "").split("\r\n")
    expect(lines[0]).toBe("Name,Age,Note")
    expect(lines.length).toBe(rows.length + 2)  // header + rows + trailing newline
  })

  it("quotes cells that contain comma, quote, or newline", () => {
    const csv = toCsv(rows, cols).replace(/^﻿/, "")
    expect(csv).toContain('"Bob, Jr."')
    expect(csv).toContain('"He said ""hi"""')
    expect(csv).toContain('"Multi\nLine"')
  })

  it("renders empty string for null / undefined", () => {
    const csv = toCsv(rows, cols).replace(/^﻿/, "")
    const lastRow = csv.split("\r\n")[3]
    // The note field for "Multi\nLine" row was null
    expect(lastRow.split(",").pop()).toBe("")
  })

  it("prefixes UTF-8 BOM so Excel detects encoding", () => {
    const csv = toCsv(rows, cols)
    expect(csv.charCodeAt(0)).toBe(0xfeff)
  })
})
