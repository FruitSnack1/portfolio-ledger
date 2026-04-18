import type { DashboardTimePoint } from './dashboardTypes'

export type PortfolioYearQuarterRow = {
  year: number
  q1: number | null
  q2: number | null
  q3: number | null
  q4: number | null
  yearTotal: number | null
}

/** CSS tone for a signed % return (reuses asset stat gain/loss classes). */
export function signedReturnToneClass(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return ''
  if (v > 0) return ' asset-detail-stat-value--gain'
  if (v < 0) return ' asset-detail-stat-value--loss'
  return ''
}

function parseMonthPoint(time: string): { year: number; month: number } | null {
  const m = /^(\d{4})-(\d{2})-01$/.exec(time.trim())
  if (!m) return null
  const year = Number(m[1])
  const month = Number(m[2])
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) return null
  return { year, month }
}

function compoundMonthlyReturns(returns: readonly number[]): number | null {
  if (returns.length === 0) return null
  let prod = 1
  for (const r of returns) {
    if (!Number.isFinite(r)) return null
    prod *= 1 + r / 100
  }
  return (prod - 1) * 100
}

function quarterMonthList(quarter: 1 | 2 | 3 | 4): readonly number[] {
  if (quarter === 1) return [1, 2, 3]
  if (quarter === 2) return [4, 5, 6]
  if (quarter === 3) return [7, 8, 9]
  return [10, 11, 12]
}

function collectReturnsForMonths(
  byYm: Map<string, number>,
  year: number,
  months: readonly number[],
): number[] {
  const out: number[] = []
  for (const mo of months) {
    const key = `${year}-${String(mo).padStart(2, '0')}`
    if (!byYm.has(key)) continue
    out.push(byYm.get(key)!)
  }
  return out
}

/**
 * Builds calendar-year rows with Q1–Q4 and full-year % returns by compounding
 * portfolio month-over-month % returns (same series as the monthly return chart).
 */
export function buildPortfolioYearQuarterRows(points: readonly DashboardTimePoint[]): PortfolioYearQuarterRow[] {
  if (points.length === 0) return []

  const byYm = new Map<string, number>()
  const years = new Set<number>()
  for (const p of points) {
    const ym = parseMonthPoint(p.time)
    if (ym == null) continue
    const key = `${ym.year}-${String(ym.month).padStart(2, '0')}`
    byYm.set(key, p.value)
    years.add(ym.year)
  }

  if (years.size === 0) return []

  const sortedYears = [...years].sort((a, b) => b - a)
  const rows: PortfolioYearQuarterRow[] = []

  for (const year of sortedYears) {
    const q1 = compoundMonthlyReturns(collectReturnsForMonths(byYm, year, quarterMonthList(1)))
    const q2 = compoundMonthlyReturns(collectReturnsForMonths(byYm, year, quarterMonthList(2)))
    const q3 = compoundMonthlyReturns(collectReturnsForMonths(byYm, year, quarterMonthList(3)))
    const q4 = compoundMonthlyReturns(collectReturnsForMonths(byYm, year, quarterMonthList(4)))
    const yearReturns = collectReturnsForMonths(byYm, year, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
    const yearTotal = compoundMonthlyReturns(yearReturns)
    rows.push({ year, q1, q2, q3, q4, yearTotal })
  }

  return rows
}

export function formatSignedPct2(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return '—'
  const sign = v > 0 ? '+' : ''
  return `${sign}${v.toFixed(2)}%`
}
