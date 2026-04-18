export type LogPeriodBalance = {
  readonly year: number
  readonly month: number
  readonly balance: string
}

export type BalanceChartPoint = {
  /** First day of month, `YYYY-MM-DD` (lightweight-charts time). */
  time: string
  value: number
}

/** Month start as ISO date for chart time scale. */
export function periodToChartTime(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}-01`
}

/** Oldest → newest; drops rows with non-finite balance. */
export function balanceOverTimePointsAsc(logs: readonly LogPeriodBalance[]): BalanceChartPoint[] {
  const sorted = [...logs].sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year
    return a.month - b.month
  })
  const out: BalanceChartPoint[] = []
  for (const row of sorted) {
    const v = Number(row.balance)
    if (!Number.isFinite(v)) continue
    out.push({ time: periodToChartTime(row.year, row.month), value: v })
  }
  return out
}
