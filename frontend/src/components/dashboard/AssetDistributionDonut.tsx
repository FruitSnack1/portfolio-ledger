export type DonutSlice = {
  name: string
  color: string
  value: number
}

type AssetDistributionDonutProps = {
  slices: readonly DonutSlice[]
  /** Outer diameter in px */
  size?: number
}

/** Simple CSS conic-gradient donut (no extra chart lib). */
export function AssetDistributionDonut({ slices, size = 200 }: AssetDistributionDonutProps) {
  const positive = slices.filter((s) => s.value > 0)
  const total = positive.reduce((s, x) => s + x.value, 0)

  if (total <= 0)
    return (
      <div className="asset-donut asset-donut--empty" style={{ width: size, height: size }}>
        <span className="muted">No balance to show</span>
      </div>
    )

  let acc = 0
  const parts: string[] = []
  for (const s of positive) {
    const p = (s.value / total) * 100
    const start = acc
    acc += p
    parts.push(`${s.color} ${start}% ${acc}%`)
  }

  const gradient = `conic-gradient(${parts.join(', ')})`

  return (
    <div className="asset-donut-wrap">
      <div
        className="asset-donut-ring"
        style={{ width: size, height: size, background: gradient }}
        aria-hidden
      />
      <div className="asset-donut-hole" />
    </div>
  )
}
