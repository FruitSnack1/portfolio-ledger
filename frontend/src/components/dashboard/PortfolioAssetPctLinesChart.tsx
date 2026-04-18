import { useEffect, useRef } from 'react'
import { ColorType, LineSeries, createChart } from 'lightweight-charts'
import { lightweightChartNoWheelCapture } from '../charts/lightweightChartNoWheelCapture'

export type AssetPctSeries = {
  id: string
  name: string
  color: string
  points: readonly { time: string; value: number }[]
}

type PortfolioAssetPctLinesChartProps = {
  seriesList: readonly AssetPctSeries[]
  resolvedTheme: 'light' | 'dark'
}

function surfaceColors(resolved: 'light' | 'dark') {
  if (resolved === 'dark')
    return {
      background: '#121a2b',
      text: '#f1f5f9',
      border: 'rgba(148, 163, 184, 0.25)',
    }
  return {
    background: '#ffffff',
    text: '#0f172a',
    border: '#e2e8f0',
  }
}

function formatPctAxis(n: number) {
  if (!Number.isFinite(n)) return '—'
  const sign = n > 0 ? '+' : ''
  return `${sign}${n.toFixed(2)}%`
}

/** Half-range for Y so min/max are ±extent and 0 sits on the midline. */
function symmetricPctHalfRange(series: readonly AssetPctSeries[]) {
  let minV = Infinity
  let maxV = -Infinity
  for (const s of series)
    for (const p of s.points) {
      if (!Number.isFinite(p.value)) continue
      if (p.value < minV) minV = p.value
      if (p.value > maxV) maxV = p.value
    }
  if (!Number.isFinite(minV) || !Number.isFinite(maxV)) return 1
  const extent = Math.max(Math.abs(minV), Math.abs(maxV))
  if (extent === 0) return 1
  return extent * 1.08
}

export function PortfolioAssetPctLinesChart({ seriesList, resolvedTheme }: PortfolioAssetPctLinesChartProps) {
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const wrap = wrapRef.current
    const withData = seriesList.filter((s) => s.points.length > 0)
    if (!wrap || withData.length === 0) return

    const colors = surfaceColors(resolvedTheme)
    const chart = createChart(wrap, {
      ...lightweightChartNoWheelCapture,
      layout: {
        background: { type: ColorType.Solid, color: colors.background },
        textColor: colors.text,
        fontFamily: 'system-ui, -apple-system, Segoe UI, sans-serif',
        attributionLogo: false,
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { visible: false },
      },
      rightPriceScale: {
        borderColor: colors.border,
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
      timeScale: {
        borderColor: colors.border,
        fixLeftEdge: true,
        fixRightEdge: true,
      },
      localization: {
        priceFormatter: formatPctAxis,
      },
      width: wrap.clientWidth,
      height: 280,
    })

    for (const s of withData) {
      const line = chart.addSeries(LineSeries, {
        color: s.color,
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
      })
      line.setData([...s.points])
    }

    chart.timeScale().fitContent()

    const half = symmetricPctHalfRange(withData)
    const rightScale = chart.priceScale('right')
    rightScale.setAutoScale(false)
    rightScale.setVisibleRange({ from: -half, to: half })

    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width
      if (w != null && w > 0) chart.applyOptions({ width: w })
    })
    ro.observe(wrap)

    return () => {
      ro.disconnect()
      chart.remove()
    }
  }, [seriesList, resolvedTheme])

  const hasAny = seriesList.some((s) => s.points.length > 0)
  if (!hasAny) return null

  return (
    <div>
      <div ref={wrapRef} className="portfolio-pct-lines-chart" />
      <ul className="portfolio-pct-legend">
        {seriesList.map((s) =>
          s.points.length === 0 ? null : (
            <li key={s.id}>
              <span className="portfolio-pct-legend-swatch" style={{ backgroundColor: s.color }} />
              <span>{s.name}</span>
            </li>
          ),
        )}
      </ul>
    </div>
  )
}
