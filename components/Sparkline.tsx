/**
 * Minimal SVG sparkline — no chart library, no dependency.
 *
 * Renders a smooth line + filled area for a numeric series. Designed for
 * inline use inside a table cell or a stat tile.
 */
interface SparklineProps {
  values: number[]
  width?: number
  height?: number
  color?: string
  fillOpacity?: number
  className?: string
  /** Label for screen readers. */
  ariaLabel?: string
}

export function Sparkline({
  values,
  width = 120,
  height = 30,
  color = "#2554a4",
  fillOpacity = 0.18,
  className,
  ariaLabel,
}: SparklineProps) {
  if (values.length === 0) {
    return (
      <svg
        width={width}
        height={height}
        className={className}
        aria-hidden={!ariaLabel}
        role={ariaLabel ? "img" : undefined}
        aria-label={ariaLabel}
      />
    )
  }

  const max = Math.max(...values, 1)
  const min = Math.min(...values, 0)
  const range = max - min || 1
  const stepX = values.length > 1 ? width / (values.length - 1) : width

  const points = values
    .map((v, i) => {
      const x = i * stepX
      const y = height - ((v - min) / range) * height
      return [x, y] as const
    })

  // Line
  const lineD = points
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`)
    .join(" ")
  // Area (close to baseline)
  const areaD =
    `M0,${height} ` +
    points.map(([x, y]) => `L${x.toFixed(2)},${y.toFixed(2)}`).join(" ") +
    ` L${width},${height} Z`

  return (
    <svg
      width={width}
      height={height}
      className={className}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      role={ariaLabel ? "img" : undefined}
      aria-label={ariaLabel}
    >
      <path d={areaD} fill={color} fillOpacity={fillOpacity} />
      <path d={lineD} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" />
    </svg>
  )
}
