import { periodToChartTime } from './logBalanceTimeSeries'

export type LogMonthEntry = {
  readonly year: number
  readonly month: number
  readonly deposit: string
  readonly balance: string
}

export type ChartGainLossColors = {
  pos: string
  neg: string
  neutral: string
}

/** Aligned with P/L over time (money) candle chart and `--success` / `--error` in `index.css`. */
const FALLBACK_GAIN_LOSS_LIGHT: ChartGainLossColors = {
  pos: '#16a34a',
  neg: '#dc2626',
  neutral: '#64748b',
}

const FALLBACK_GAIN_LOSS_DARK: ChartGainLossColors = {
  pos: '#4ade80',
  neg: '#f87171',
  neutral: '#94a3b8',
}

/** Matches `:root` / `html[data-theme='dark']` `--success`, `--error`, `--text-muted` when CSS is loaded. */
export function chartGainLossColorsFromDocument(): ChartGainLossColors {
  if (typeof document === 'undefined') return FALLBACK_GAIN_LOSS_LIGHT
  const cs = getComputedStyle(document.documentElement)
  const read = (name: string, fallback: string) => {
    const v = cs.getPropertyValue(name).trim()
    return v || fallback
  }
  return {
    pos: read('--success', FALLBACK_GAIN_LOSS_LIGHT.pos),
    neg: read('--error', FALLBACK_GAIN_LOSS_LIGHT.neg),
    neutral: read('--text-muted', FALLBACK_GAIN_LOSS_LIGHT.neutral),
  }
}

export function defaultChartGainLossColors(resolved: 'light' | 'dark'): ChartGainLossColors {
  if (resolved === 'dark') return { ...FALLBACK_GAIN_LOSS_DARK }
  return { ...FALLBACK_GAIN_LOSS_LIGHT }
}

export type HistogramBarPoint = {
  time: string
  value: number
  color: string
}

function parseFinite(s: string): number | null {
  const n = Number(s)
  if (!Number.isFinite(n)) return null
  return n
}

/**
 * Per log month (oldest → newest): money P/L vs prior month-end and deposit;
 * percent vs prior balance + this month’s deposit. Neutral bar when % is undefined.
 */
export function monthlyPerformanceHistogramAsc(
  logs: readonly LogMonthEntry[],
  colors: ChartGainLossColors,
): { moneyBars: HistogramBarPoint[]; percentBars: HistogramBarPoint[] } {
  const sorted = [...logs].sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year
    return a.month - b.month
  })

  const moneyBars: HistogramBarPoint[] = []
  const percentBars: HistogramBarPoint[] = []

  const valid = sorted.filter((row) => parseFinite(row.balance) != null)
  for (let i = 0; i < valid.length; i++) {
    const row = valid[i]
    const currB = parseFinite(row.balance)!
    const dep = parseFinite(row.deposit) ?? 0
    const prevB = i === 0 ? 0 : (parseFinite(valid[i - 1].balance) ?? 0)
    const moneyPL = currB - prevB - dep
    const time = periodToChartTime(row.year, row.month)

    moneyBars.push({
      time,
      value: moneyPL,
      color: moneyPL >= 0 ? colors.pos : colors.neg,
    })

    const startBase = prevB + dep
    let pct: number | null = null
    if (startBase > 0) pct = (moneyPL / startBase) * 100

    if (pct != null && Number.isFinite(pct))
      percentBars.push({
        time,
        value: pct,
        color: pct >= 0 ? colors.pos : colors.neg,
      })
    else
      percentBars.push({
        time,
        value: 0,
        color: colors.neutral,
      })
  }

  return { moneyBars, percentBars }
}
