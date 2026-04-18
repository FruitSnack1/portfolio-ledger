import { useEffect, useRef } from 'react'
import { ColorType, HistogramSeries, createChart } from 'lightweight-charts'
import type { HistogramBarPoint } from '../../asset/logMonthlyPerformanceSeries'
import { lightweightChartNoWheelCapture } from './lightweightChartNoWheelCapture'

type HistogramBarChartProps = {
  points: readonly HistogramBarPoint[]
  /** Right-axis tick / crosshair label */
  formatPrice: (value: number) => string
  resolvedTheme: 'light' | 'dark'
  height?: number
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

export function HistogramBarChart({ points, formatPrice, resolvedTheme, height = 220 }: HistogramBarChartProps) {
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap || points.length === 0) return

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
        priceFormatter: formatPrice,
      },
      width: wrap.clientWidth,
      height,
    })

    const series = chart.addSeries(HistogramSeries, {
      color: colors.text,
      base: 0,
      priceLineVisible: false,
      lastValueVisible: false,
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
  }, [points, formatPrice, resolvedTheme, height])

  if (points.length === 0) return null

  return <div ref={wrapRef} className="histogram-bar-chart" />
}
