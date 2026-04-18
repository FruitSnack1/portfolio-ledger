/** Minimal log row shape for stats (matches API / DB numeric strings). */
export type AssetLogStatsInput = {
  readonly year: number
  readonly month: number
  readonly deposit: string
  readonly balance: string
}

export type AssetLogStats = {
  hasLogs: boolean
  /** Balance from the log with the greatest (year, month). */
  currentBalance: number | null
  /** Sum of all `deposit` values (finite numbers only). */
  sumDeposits: number
  /** `currentBalance - sumDeposits` when balance is known. */
  gain: number | null
  /**
   * Return on contributed capital: `(currentBalance - sumDeposits) / sumDeposits * 100`
   * when `sumDeposits > 0` and `currentBalance` is finite; otherwise `null`.
   */
  percentPL: number | null
}

function parseFiniteNumber(raw: string): number | null {
  const n = Number(raw)
  if (!Number.isFinite(n)) return null
  return n
}

/** Sort by calendar period descending (latest first). */
export function sortAssetLogsByPeriodDesc<T extends AssetLogStatsInput>(logs: readonly T[]): T[] {
  return [...logs].sort((a, b) => {
    if (b.year !== a.year) return b.year - a.year
    return b.month - a.month
  })
}

/** Aggregate balance, deposits, and P/L % from monthly asset logs. */
export function computeAssetLogStats(logs: readonly AssetLogStatsInput[]): AssetLogStats {
  if (logs.length === 0)
    return {
      hasLogs: false,
      currentBalance: null,
      sumDeposits: 0,
      gain: null,
      percentPL: null,
    }

  let sumDeposits = 0
  for (const row of logs) {
    const d = parseFiniteNumber(row.deposit)
    if (d != null) sumDeposits += d
  }

  const sorted = sortAssetLogsByPeriodDesc(logs)
  const latest = sorted[0]
  const currentBalance = parseFiniteNumber(latest.balance)

  const gain = currentBalance != null ? currentBalance - sumDeposits : null
  const percentPL =
    sumDeposits > 0 && currentBalance != null ? ((currentBalance - sumDeposits) / sumDeposits) * 100 : null

  return {
    hasLogs: true,
    currentBalance,
    sumDeposits,
    gain,
    percentPL,
  }
}

/** Display P/L %, N/A when deposits sum to zero, em dash when unknown. */
export function formatPercentPLStat(stats: AssetLogStats): string {
  if (!stats.hasLogs) return '—'
  if (stats.sumDeposits === 0) return 'N/A'
  if (stats.percentPL == null || !Number.isFinite(stats.percentPL)) return '—'
  const v = stats.percentPL
  const sign = v > 0 ? '+' : ''
  return `${sign}${v.toFixed(2)}%`
}

/** Leading space + BEM modifier for positive/negative P/L coloring; empty when not applicable. */
export function percentPLStatToneClass(stats: AssetLogStats): string {
  const p = stats.percentPL
  if (p == null || !Number.isFinite(p)) return ''
  if (p > 0) return ' asset-detail-stat-value--gain'
  if (p < 0) return ' asset-detail-stat-value--loss'
  return ''
}

/** Tone for money P/L (`gain`) when % is unavailable or for consistent gain/loss hue. */
export function gainMoneyStatToneClass(stats: AssetLogStats): string {
  const g = stats.gain
  if (g == null || !Number.isFinite(g)) return ''
  if (g > 0) return ' asset-detail-stat-value--gain'
  if (g < 0) return ' asset-detail-stat-value--loss'
  return ''
}
