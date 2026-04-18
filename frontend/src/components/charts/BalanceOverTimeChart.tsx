import { useEffect, useRef } from 'react'
import { AreaSeries, ColorType, createChart } from 'lightweight-charts'
import type { BalanceChartPoint } from '../../asset/logBalanceTimeSeries'
import { formatDisplayMoney } from '../../currency/formatDisplayMoney'
import { useTheme } from '../../theme/ThemeProvider'

export type BalanceOverTimeChartProps = {
  points: readonly BalanceChartPoint[]
  /** Line color (e.g. asset swatch). */
  lineColor: string
  displayCurrency: string | null
}

function hexToRgba(hex: string, alpha: number): string {
  const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hex.trim())
  if (!m) return `rgba(100, 116, 139, ${alpha})`
  const r = parseInt(m[1], 16)
  const g = parseInt(m[2], 16)
  const b = parseInt(m[3], 16)
  return `rgba(${r},${g},${b},${alpha})`
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

export function BalanceOverTimeChart({ points, lineColor, displayCurrency }: BalanceOverTimeChartProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const { resolved } = useTheme()

  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap || points.length === 0) return

    const colors = chartColors(resolved)
    const chart = createChart(wrap, {
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
        priceFormatter: (price: number) => formatDisplayMoney(price, displayCurrency),
      },
      width: wrap.clientWidth,
      height: 260,
    })

    const series = chart.addSeries(AreaSeries, {
      lineColor,
      lineWidth: 2,
      topColor: hexToRgba(lineColor, 0.38),
      bottomColor: hexToRgba(lineColor, 0),
      relativeGradient: false,
      crosshairMarkerVisible: true,
      lastValueVisible: true,
      priceLineVisible: false,
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
  }, [points, displayCurrency, lineColor, resolved])

  if (points.length === 0) return null

  return <div ref={wrapRef} className="balance-over-time-chart" />
}
