/**
 * Circular progress gauge (SVG, no chart library).
 *
 * Renders a percentage as a stroked arc; color shifts to amber > 70%
 * and red > 90% so a glance at the dashboard tells you whether you're
 * close to a heap/CPU limit.
 */
interface GaugeProps {
  value: number    // 0..100
  label: string
  /** Optional second-line caption (e.g. "169 / 512 MB"). */
  caption?: string
  size?: number    // px
  thickness?: number  // px
}

export function Gauge({ value, label, caption, size = 96, thickness = 8 }: GaugeProps) {
  const v = Math.max(0, Math.min(100, value))
  const tone = v >= 90 ? "bad" : v >= 70 ? "warn" : "ok"
  const color =
    tone === "bad" ? "#dc2626" : tone === "warn" ? "#d97706" : "#16a34a"
  const trackColor = "currentColor"

  const radius = (size - thickness) / 2
  const circumference = 2 * Math.PI * radius
  const dash = (v / 100) * circumference

  return (
    <div className="flex flex-col items-center">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="text-ink-200 dark:text-ink-700"
        role="img"
        aria-label={`${label}: ${v.toFixed(0)} percent`}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={trackColor}
          strokeWidth={thickness}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={thickness}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        <text
          x="50%"
          y="50%"
          textAnchor="middle"
          dominantBaseline="central"
          className="fill-ink-900 dark:fill-ink-100"
          style={{ font: "600 18px ui-sans-serif, system-ui, sans-serif" }}
        >
          {v.toFixed(0)}%
        </text>
      </svg>
      <div className="mt-1 text-xs uppercase tracking-wide text-ink-600 dark:text-ink-400 text-center">
        {label}
      </div>
      {caption ? (
        <div className="text-[11px] text-ink-600 dark:text-ink-400 text-center font-mono">
          {caption}
        </div>
      ) : null}
    </div>
  )
}
