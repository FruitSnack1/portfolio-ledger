import { useEffect, useRef } from 'react'
import { ColorType, LineSeries, createChart } from 'lightweight-charts'
import type { BalanceChartPoint } from '../../asset/logBalanceTimeSeries'
import { formatDisplayMoney } from '../../currency/formatDisplayMoney'
import { useTheme } from '../../theme/ThemeProvider'
import { CHART_INTL_LOCALE } from './chartLocale'
import { lightweightChartNoWheelCapture } from './lightweightChartNoWheelCapture'

export type BalanceOverTimeChartProps = {
  points: readonly BalanceChartPoint[]
  /** Line color (e.g. asset swatch). */
  lineColor: string
  displayCurrency: string | null
  /** Optional second line: cumulative deposits through each month (same time scale as balance). */
  depositPoints?: readonly BalanceChartPoint[]
  /** Stroke for the cumulative deposit line; defaults to a sky accent per theme. */
  depositLineColor?: string
}

function chartColors(resolved: 'light' | 'dark') {
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

function defaultDepositLineColor(resolved: 'light' | 'dark') {
  if (resolved === 'dark') return '#94a3b8'
  return '#64748b'
}

export function BalanceOverTimeChart({
  points,
  lineColor,
  displayCurrency,
  depositPoints,
  depositLineColor,
}: BalanceOverTimeChartProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const { resolved } = useTheme()
  const showDeposit = depositPoints != null && depositPoints.length > 0
  const depositStroke = depositLineColor ?? defaultDepositLineColor(resolved)

  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap || points.length === 0) return

    const colors = chartColors(resolved)
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
        scaleMargins: { top: 0.08, bottom: 0.08 },
      },
      timeScale: {
        borderColor: colors.border,
        fixLeftEdge: true,
        fixRightEdge: true,
      },
      localization: {
        locale: CHART_INTL_LOCALE,
        priceFormatter: (price: number) => formatDisplayMoney(price, displayCurrency),
      },
      width: wrap.clientWidth,
      height: 260,
    })

    if (showDeposit && depositPoints != null) {
      const depositSeries = chart.addSeries(LineSeries, {
        color: depositStroke,
        lineWidth: 2,
        crosshairMarkerVisible: true,
        lastValueVisible: true,
        priceLineVisible: false,
      })
      depositSeries.setData([...depositPoints])
    }

    const balanceSeries = chart.addSeries(LineSeries, {
      color: lineColor,
      lineWidth: 2,
      crosshairMarkerVisible: true,
      lastValueVisible: true,
      priceLineVisible: false,
    })
    balanceSeries.setData([...points])

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
  }, [points, depositPoints, displayCurrency, lineColor, depositStroke, resolved, showDeposit])

  if (points.length === 0) return null

  return (
    <div>
      <div ref={wrapRef} className="balance-over-time-chart" />
      {showDeposit ? (
        <ul className="dual-line-portfolio-legend" aria-label="Chart legend">
          <li>
            <span className="dual-line-portfolio-swatch" style={{ backgroundColor: lineColor }} aria-hidden />
            Balance
          </li>
          <li>
            <span className="dual-line-portfolio-swatch" style={{ backgroundColor: depositStroke }} aria-hidden />
            Cumulative deposits
          </li>
        </ul>
      ) : null}
    </div>
  )
}
