import { useEffect, useRef } from 'react'
import { ColorType, HistogramSeries, createChart } from 'lightweight-charts'
import type { HistogramBarPoint } from '../../asset/logMonthlyPerformanceSeries'
import { CHART_INTL_LOCALE } from './chartLocale'
import { lightweightChartNoWheelCapture } from './lightweightChartNoWheelCapture'

type HistogramBarChartProps = {
  points: readonly HistogramBarPoint[]
  /** Right-axis tick / crosshair label */
  formatPrice: (value: number) => string
  resolvedTheme: 'light' | 'dark'
  height?: number
  /** When true, Y scale is symmetric around 0 so the baseline sits in the middle. */
  symmetricZero?: boolean
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

function symmetricHistogramHalfRange(values: readonly number[]): number {
  let maxAbs = 0
  for (const v of values) {
    const a = Math.abs(v)
    if (a > maxAbs) maxAbs = a
  }
  if (maxAbs === 0) return 1
  return maxAbs * 1.12
}

export function HistogramBarChart({
  points,
  formatPrice,
  resolvedTheme,
  height = 220,
  symmetricZero = false,
}: HistogramBarChartProps) {
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
        scaleMargins: symmetricZero ? { top: 0.04, bottom: 0.04 } : { top: 0.1, bottom: 0.1 },
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
      height,
    })

    const fallbackBarColor = points[0]?.color ?? colors.text
    const series = chart.addSeries(HistogramSeries, {
      color: fallbackBarColor,
      base: 0,
      priceLineVisible: false,
      lastValueVisible: false,
    })
    series.setData([...points])

    chart.timeScale().fitContent()

    function applySymmetricScale() {
      const half = symmetricHistogramHalfRange(points.map((p) => p.value))
      const rightScale = chart.priceScale('right')
      rightScale.setAutoScale(false)
      rightScale.setVisibleRange({ from: -half, to: half })
    }

    if (symmetricZero) applySymmetricScale()

    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width
      if (w == null || w <= 0) return
      chart.applyOptions({ width: w })
      if (symmetricZero) applySymmetricScale()
    })
    ro.observe(wrap)

    return () => {
      ro.disconnect()
      chart.remove()
    }
  }, [points, formatPrice, resolvedTheme, height, symmetricZero])

  if (points.length === 0) return null

  return <div ref={wrapRef} className="histogram-bar-chart" />
}
