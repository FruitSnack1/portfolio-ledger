import { useEffect, useRef } from 'react'
import { CandlestickSeries, ColorType, createChart } from 'lightweight-charts'
import type { CandlestickData, Time } from 'lightweight-charts'
import { defaultChartGainLossColors } from '../../asset/logMonthlyPerformanceSeries'
import { CHART_INTL_LOCALE } from '../charts/chartLocale'
import { lightweightChartNoWheelCapture } from '../charts/lightweightChartNoWheelCapture'
import type { DashboardPlOverTimePoint, DashboardTimePoint } from './dashboardTypes'

type PlCandleChartProps = {
  candles: CandlestickData<Time>[]
  formatPrice: (value: number) => string
  resolvedTheme: 'light' | 'dark'
  rootClassName?: string
}

function formatPctAxis(n: number) {
  if (!Number.isFinite(n)) return '—'
  const sign = n > 0 ? '+' : ''
  return `${sign}${n.toFixed(2)}%`
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

/** Builds OHLC from a time series: open = prior value, close = this point. */
function plPointsToCandles(points: readonly { time: string; value: number }[]): CandlestickData<Time>[] {
  const out: CandlestickData<Time>[] = []
  for (let i = 0; i < points.length; i++) {
    const p = points[i]
    const close = p.value
    const open = i === 0 ? close : points[i - 1].value
    let high = Math.max(open, close)
    let low = Math.min(open, close)
    if (high === low) {
      const pad = Math.max(1e-9, Math.abs(close) * 1e-6)
      high += pad
      low -= pad
    }
    out.push({ time: p.time as Time, open, high, low, close })
  }
  return out
}

function PlMoneyCandleChart({ candles, formatPrice, resolvedTheme, rootClassName }: PlCandleChartProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const gl = defaultChartGainLossColors(resolvedTheme)
  const upColor = gl.pos
  const downColor = gl.neg
  const wrapClass = rootClassName ?? 'pl-over-time-chart pl-over-time-chart--money'

  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap || candles.length === 0) return

    const colors = surfaceColors(resolvedTheme)
    const chart = createChart(wrap, {
      ...lightweightChartNoWheelCapture,
      layout: {
        background: { type: ColorType.Solid, color: colors.background },
        textColor: colors.text,
        fontFamily: 'system-ui, -apple-system, Segoe UI, sans-serif',
        attributionLogo: false,
      },
      grid: { vertLines: { visible: false }, horzLines: { visible: false } },
      rightPriceScale: { borderColor: colors.border, scaleMargins: { top: 0.1, bottom: 0.1 } },
      timeScale: { borderColor: colors.border, fixLeftEdge: true, fixRightEdge: true },
      localization: { locale: CHART_INTL_LOCALE, priceFormatter: formatPrice },
      width: wrap.clientWidth,
      height: 220,
    })

    const series = chart.addSeries(CandlestickSeries, {
      upColor,
      downColor,
      borderVisible: false,
      wickUpColor: upColor,
      wickDownColor: downColor,
    })
    series.setData([...candles])
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
  }, [candles, formatPrice, upColor, downColor, resolvedTheme])

  if (candles.length === 0) return null
  return <div ref={wrapRef} className={wrapClass} />
}

export function PlOverTimeMoneyCandles({
  points,
  formatMoney,
  resolvedTheme,
}: {
  points: readonly DashboardPlOverTimePoint[]
  formatMoney: (value: number) => string
  resolvedTheme: 'light' | 'dark'
}) {
  const moneySeries = points.map((p) => ({ time: p.time, value: p.plMoney }))
  if (moneySeries.length === 0) return null
  const candles = plPointsToCandles(moneySeries)
  return <PlMoneyCandleChart candles={candles} formatPrice={formatMoney} resolvedTheme={resolvedTheme} />
}

/** % time series as candles (e.g. month-over-month portfolio return % per month). */
export function PortfolioMonthlyReturnCandles({
  series,
  resolvedTheme,
}: {
  series: readonly DashboardTimePoint[]
  resolvedTheme: 'light' | 'dark'
}) {
  if (series.length === 0) return null
  const candles = plPointsToCandles(series)
  return (
    <PlMoneyCandleChart
      candles={candles}
      formatPrice={formatPctAxis}
      resolvedTheme={resolvedTheme}
      rootClassName="pl-over-time-chart pl-over-time-chart--pct"
    />
  )
}
