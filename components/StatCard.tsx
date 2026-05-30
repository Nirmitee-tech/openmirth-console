interface StatCardProps {
  label: string
  value: string | number
  sub?: string
  tone?: "neutral" | "good" | "warn" | "bad"
}

const toneClass: Record<NonNullable<StatCardProps["tone"]>, string> = {
  neutral: "text-ink-900",
  good: "text-emerald-700",
  warn: "text-amber-700",
  bad: "text-red-700",
}

export function StatCard({ label, value, sub, tone = "neutral" }: StatCardProps) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-ink-200 p-5">
      <div className="text-xs uppercase tracking-wide text-ink-600">{label}</div>
      <div className={`mt-1 text-3xl font-semibold tabular-nums ${toneClass[tone]}`}>
        {value}
      </div>
      {sub ? <div className="mt-1 text-xs text-ink-600">{sub}</div> : null}
    </div>
  )
}
