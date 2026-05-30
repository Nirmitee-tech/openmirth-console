"use client"

import CodeMirror from "@uiw/react-codemirror"
import { javascript } from "@codemirror/lang-javascript"
import { xml } from "@codemirror/lang-xml"
import { oneDark } from "@codemirror/theme-one-dark"
import { useMemo } from "react"

interface CodeEditorProps {
  value: string
  onChange: (v: string) => void
  language?: "javascript" | "xml"
  readOnly?: boolean
  minHeight?: string
}

/**
 * Thin wrapper around @uiw/react-codemirror.
 *
 * Kept stupid-simple on purpose: we expose only the knobs every
 * call-site here actually uses. Add features as needed; resist adding
 * everything CodeMirror supports just because it's possible.
 */
export function CodeEditor({
  value,
  onChange,
  language = "javascript",
  readOnly = false,
  minHeight = "240px",
}: CodeEditorProps) {
  const extensions = useMemo(
    () => (language === "xml" ? [xml()] : [javascript()]),
    [language]
  )
  return (
    <div className="rounded border border-ink-200 overflow-hidden">
      <CodeMirror
        value={value}
        onChange={onChange}
        theme={oneDark}
        extensions={extensions}
        readOnly={readOnly}
        basicSetup={{
          lineNumbers: true,
          highlightActiveLine: true,
          highlightSelectionMatches: true,
          autocompletion: !readOnly,
          foldGutter: true,
          tabSize: 2,
          indentOnInput: true,
        }}
        style={{ fontSize: "13px", minHeight }}
      />
    </div>
  )
}
