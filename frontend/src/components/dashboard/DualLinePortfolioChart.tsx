import { useEffect, useRef } from 'react'
import { ColorType, LineSeries, createChart } from 'lightweight-charts'
import { CHART_INTL_LOCALE } from '../charts/chartLocale'
import { lightweightChartNoWheelCapture } from '../charts/lightweightChartNoWheelCapture'

export type DualLinePoint = { time: string; value: number }

type DualLinePortfolioChartProps = {
  seriesA: { points: readonly DualLinePoint[]; color: string; label: string }
  seriesB: { points: readonly DualLinePoint[]; color: string; label: string }
  formatPrice: (value: number) => string
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

export function DualLinePortfolioChart({ seriesA, seriesB, formatPrice, resolvedTheme }: DualLinePortfolioChartProps) {
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap || seriesA.points.length === 0 || seriesB.points.length === 0) return

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
        scaleMargins: { top: 0.08, bottom: 0.08 },
      },
      timeScale: {
        borderColor: colors.border,
        fixLeftEdge: true,
        fixRightEdge: true,
      },
      localization: {
        locale: CHART_INTL_LOCALE,
        priceFormatter: formatPrice,
      },
      width: wrap.clientWidth,
      height: 260,
    })

    const lineA = chart.addSeries(LineSeries, {
      color: seriesA.color,
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: true,
    })
    lineA.setData([...seriesA.points])

    const lineB = chart.addSeries(LineSeries, {
      color: seriesB.color,
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: true,
    })
    lineB.setData([...seriesB.points])

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
  }, [seriesA, seriesB, formatPrice, resolvedTheme])

  if (seriesA.points.length === 0 || seriesB.points.length === 0) return null

  return (
    <div>
      <div ref={wrapRef} className="dual-line-portfolio-chart" />
      <ul className="dual-line-portfolio-legend">
        <li>
          <span className="dual-line-portfolio-swatch" style={{ backgroundColor: seriesA.color }} aria-hidden />
          {seriesA.label}
        </li>
        <li>
          <span className="dual-line-portfolio-swatch" style={{ backgroundColor: seriesB.color }} aria-hidden />
          {seriesB.label}
        </li>
      </ul>
    </div>
  )
}
