import { useEffect, useRef } from 'react'
import { ColorType, LineSeries, createChart } from 'lightweight-charts'
import type { DashboardPlOverTimePoint } from './dashboardTypes'

type PlOverTimeChartsProps = {
  points: readonly DashboardPlOverTimePoint[]
  formatMoney: (value: number) => string
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

function PlMoneyLineChart({
  points,
  formatMoney,
  resolvedTheme,
}: {
  points: readonly { time: string; value: number }[]
  formatMoney: (value: number) => string
  resolvedTheme: 'light' | 'dark'
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const lineColor = resolvedTheme === 'dark' ? '#94a3b8' : '#475569'

  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap || points.length === 0) return

    const colors = surfaceColors(resolvedTheme)
    const chart = createChart(wrap, {
      layout: {
        background: { type: ColorType.Solid, color: colors.background },
        textColor: colors.text,
        fontFamily: 'system-ui, -apple-system, Segoe UI, sans-serif',
        attributionLogo: false,
      },
      grid: { vertLines: { visible: false }, horzLines: { visible: false } },
      rightPriceScale: { borderColor: colors.border, scaleMargins: { top: 0.1, bottom: 0.1 } },
      timeScale: { borderColor: colors.border, fixLeftEdge: true, fixRightEdge: true },
      localization: { priceFormatter: formatMoney },
      width: wrap.clientWidth,
      height: 200,
    })

    const series = chart.addSeries(LineSeries, {
      color: lineColor,
      lineWidth: 2,
      priceLineVisible: true,
      lastValueVisible: true,
    })
    series.setData([...points])
    chart.timeScale().fitContent()

    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width
      if (w != null && w > 0) chart.applyOptions({ width: w })
    })
    ro.observe(wrap)
    return () => {
      ro.disconnect()
      chart.remove()
    }
  }, [points, formatMoney, lineColor, resolvedTheme])

  if (points.length === 0) return null
  return <div ref={wrapRef} className="pl-over-time-chart pl-over-time-chart--money" />
}

function PlPctLineChart({
  points,
  resolvedTheme,
}: {
  points: readonly { time: string; value: number }[]
  resolvedTheme: 'light' | 'dark'
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const lineColor = resolvedTheme === 'dark' ? '#a78bfa' : '#6d28d9'

  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap || points.length === 0) return

    const colors = surfaceColors(resolvedTheme)
    const chart = createChart(wrap, {
      layout: {
        background: { type: ColorType.Solid, color: colors.background },
        textColor: colors.text,
        fontFamily: 'system-ui, -apple-system, Segoe UI, sans-serif',
        attributionLogo: false,
      },
      grid: { vertLines: { visible: false }, horzLines: { visible: false } },
      rightPriceScale: { borderColor: colors.border, scaleMargins: { top: 0.1, bottom: 0.1 } },
      timeScale: { borderColor: colors.border, fixLeftEdge: true, fixRightEdge: true },
      localization: { priceFormatter: formatPctAxis },
      width: wrap.clientWidth,
      height: 180,
    })

    const series = chart.addSeries(LineSeries, {
      color: lineColor,
      lineWidth: 2,
      priceLineVisible: true,
      lastValueVisible: true,
    })
    series.setData([...points])
    chart.timeScale().fitContent()

    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width
      if (w != null && w > 0) chart.applyOptions({ width: w })
    })
    ro.observe(wrap)
    return () => {
      ro.disconnect()
      chart.remove()
    }
  }, [points, lineColor, resolvedTheme])

  if (points.length === 0) return null
  return <div ref={wrapRef} className="pl-over-time-chart pl-over-time-chart--pct" />
}

export function PlOverTimeCharts({ points, formatMoney, resolvedTheme }: PlOverTimeChartsProps) {
  const moneySeries = points.map((p) => ({ time: p.time, value: p.plMoney }))
  const pctSeries = points
    .filter((p) => p.plPercent != null && Number.isFinite(p.plPercent))
    .map((p) => ({ time: p.time, value: p.plPercent as number }))

  if (moneySeries.length === 0) return null

  return (
    <div className="pl-over-time-charts">
      <div>
        <h3 className="dashboard-subchart-title">P/L (money)</h3>
        <p className="muted dashboard-subchart-lead">Total balance minus cumulative deposits through each month.</p>
        <PlMoneyLineChart points={moneySeries} formatMoney={formatMoney} resolvedTheme={resolvedTheme} />
      </div>
      {pctSeries.length > 0 ? (
        <div>
          <h3 className="dashboard-subchart-title">P/L % of cumulative deposits</h3>
          <p className="muted dashboard-subchart-lead">Same gap as a percentage of what you have put in so far.</p>
          <PlPctLineChart points={pctSeries} resolvedTheme={resolvedTheme} />
        </div>
      ) : null}
    </div>
  )
}
