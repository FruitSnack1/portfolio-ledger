export type DashboardAssetInput = {
  id: string
  name: string
  color: string
}

export type DashboardLogInput = {
  assetId: string
  year: number
  month: number
  deposit: string
  balance: string
}

export type DashboardTimePoint = { time: string; value: number }

export type DashboardAssetSlice = {
  assetId: string
  name: string
  color: string
  latestBalance: number
  weight: number
}

export type DashboardAssetRow = {
  id: string
  name: string
  color: string
  sumDeposits: number
  latestBalance: number
  plMoney: number
  plPercent: number | null
  monthlyPercentPoints: DashboardTimePoint[]
}

export type DashboardDepositStackSlice = {
  assetId: string
  name: string
  color: string
  deposit: number
}

export type DashboardDepositsByMonth = {
  time: string
  total: number
  byAsset: DashboardDepositStackSlice[]
}

export type DashboardPlOverTimePoint = {
  time: string
  plMoney: number
  plPercent: number | null
}

export type DashboardHeatmapRow = {
  assetId: string
  name: string
  color: string
  /** Same order as heatmapMonthLabels */
  pctValues: (number | null)[]
}

export type DashboardDataHealthAsset = {
  assetId: string
  name: string
  color: string
  hasLogs: boolean
  firstLogPeriod: string | null
  latestLogPeriod: string | null
  missingMonthsInRange: number
  /** Up to 6 ISO month labels for UI */
  missingSample: string[]
}

export type DashboardPayload = {
  totals: {
    totalBalance: number
    totalDeposits: number
    plMoney: number
    plPercent: number | null
  }
  balanceOverTime: DashboardTimePoint[]
  cumulativeDepositsOverTime: DashboardTimePoint[]
  portfolioMonthlyReturnPercent: DashboardTimePoint[]
  depositsByMonth: DashboardDepositsByMonth[]
  plOverTime: DashboardPlOverTimePoint[]
  heatmapMonthLabels: string[]
  heatmapRows: DashboardHeatmapRow[]
  distribution: DashboardAssetSlice[]
  assets: DashboardAssetRow[]
  dataHealth: DashboardDataHealthAsset[]
}

function parseMoney(raw: string): number {
  const n = Number(raw)
  return Number.isFinite(n) ? n : 0
}

function periodToTime(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}-01`
}

function periodCompare(a: { year: number; month: number }, b: { year: number; month: number }): number {
  if (a.year !== b.year) return a.year - b.year
  return a.month - b.month
}

function sortLogsAsc(logs: DashboardLogInput[]): DashboardLogInput[] {
  return [...logs].sort((x, y) => periodCompare(x, y))
}

function carriedBalanceAtEndOfMonth(logsAsc: DashboardLogInput[], year: number, month: number): number {
  let last = 0
  let any = false
  for (const row of logsAsc) {
    if (row.year > year || (row.year === year && row.month > month)) break
    last = parseMoney(row.balance)
    any = true
  }
  if (!any) return 0
  return last
}

function depositInMonth(logsAsc: DashboardLogInput[], year: number, month: number): number {
  for (const row of logsAsc) if (row.year === year && row.month === month) return parseMoney(row.deposit)
  return 0
}

/** Month-over-month % return for one asset’s log row at (year, month), or null if no row. */
function monthlyPctForAssetMonth(logsAsc: DashboardLogInput[], year: number, month: number): number | null {
  const idx = logsAsc.findIndex((r) => r.year === year && r.month === month)
  if (idx < 0) return null
  const row = logsAsc[idx]
  const currB = parseMoney(row.balance)
  const dep = parseMoney(row.deposit)
  const prevB = idx === 0 ? 0 : parseMoney(logsAsc[idx - 1].balance)
  const startBase = prevB + dep
  if (!(startBase > 0)) return null
  const moneyPL = currB - prevB - dep
  return (moneyPL / startBase) * 100
}

function missingMonthsInLoggedRange(logsAsc: DashboardLogInput[]): string[] {
  if (logsAsc.length === 0) return []
  const mm = minMaxPeriod(logsAsc)
  if (mm == null) return []
  const all = enumerateMonthsInclusive(mm.min, mm.max)
  const have = new Set<string>()
  for (const r of logsAsc) have.add(`${r.year}-${r.month}`)
  const missing: string[] = []
  for (const p of all) {
    if (have.has(`${p.year}-${p.month}`)) continue
    missing.push(periodToTime(p.year, p.month))
  }
  return missing
}

function computeAssetMetrics(logs: DashboardLogInput[]): {
  sumDeposits: number
  latestBalance: number
  plMoney: number
  plPercent: number | null
  monthlyPercentPoints: DashboardTimePoint[]
} {
  if (logs.length === 0)
    return {
      sumDeposits: 0,
      latestBalance: 0,
      plMoney: 0,
      plPercent: null,
      monthlyPercentPoints: [],
    }

  const sortedDesc = [...logs].sort((a, b) => -periodCompare(a, b))
  let sumDeposits = 0
  for (const row of logs) sumDeposits += parseMoney(row.deposit)

  const latestBalance =
    sortedDesc.length > 0 && Number.isFinite(parseMoney(sortedDesc[0].balance))
      ? parseMoney(sortedDesc[0].balance)
      : 0

  const plMoney = latestBalance - sumDeposits
  const plPercent = sumDeposits > 0 ? (plMoney / sumDeposits) * 100 : null

  const sortedAsc = sortLogsAsc(logs)
  const valid = sortedAsc.filter((row) => Number.isFinite(parseMoney(row.balance)))
  const monthlyPercentPoints: DashboardTimePoint[] = []
  for (let i = 0; i < valid.length; i++) {
    const row = valid[i]
    const currB = parseMoney(row.balance)
    const dep = parseMoney(row.deposit)
    const prevB = i === 0 ? 0 : parseMoney(valid[i - 1].balance)
    const moneyPL = currB - prevB - dep
    const startBase = prevB + dep
    const pct = startBase > 0 ? (moneyPL / startBase) * 100 : 0
    monthlyPercentPoints.push({ time: periodToTime(row.year, row.month), value: pct })
  }

  return { sumDeposits, latestBalance, plMoney, plPercent, monthlyPercentPoints }
}

function minMaxPeriod(logs: DashboardLogInput[]): { min: { year: number; month: number }; max: { year: number; month: number } } | null {
  if (logs.length === 0) return null
  let minY = logs[0].year
  let minM = logs[0].month
  let maxY = logs[0].year
  let maxM = logs[0].month
  for (const row of logs) {
    if (periodCompare(row, { year: minY, month: minM }) < 0) {
      minY = row.year
      minM = row.month
    }
    if (periodCompare(row, { year: maxY, month: maxM }) > 0) {
      maxY = row.year
      maxM = row.month
    }
  }
  return { min: { year: minY, month: minM }, max: { year: maxY, month: maxM } }
}

function nextMonth(year: number, month: number): { year: number; month: number } {
  if (month === 12) return { year: year + 1, month: 1 }
  return { year, month: month + 1 }
}

function enumerateMonthsInclusive(
  from: { year: number; month: number },
  to: { year: number; month: number },
): { year: number; month: number }[] {
  const out: { year: number; month: number }[] = []
  let y = from.year
  let m = from.month
  for (;;) {
    out.push({ year: y, month: m })
    if (y === to.year && m === to.month) break
    const n = nextMonth(y, m)
    y = n.year
    m = n.month
  }
  return out
}

/** Build portfolio dashboard from user assets and all their logs. */
export function buildDashboard(assets: readonly DashboardAssetInput[], logs: readonly DashboardLogInput[]): DashboardPayload {
  const byAsset = new Map<string, DashboardLogInput[]>()
  for (const a of assets) byAsset.set(a.id, [])
  for (const row of logs) {
    const list = byAsset.get(row.assetId)
    if (list) list.push(row)
  }

  const assetRows: DashboardAssetRow[] = assets.map((a) => {
    const lg = byAsset.get(a.id) ?? []
    const m = computeAssetMetrics(lg)
    return {
      id: a.id,
      name: a.name,
      color: a.color,
      sumDeposits: m.sumDeposits,
      latestBalance: m.latestBalance,
      plMoney: m.plMoney,
      plPercent: m.plPercent,
      monthlyPercentPoints: m.monthlyPercentPoints,
    }
  })

  let totalBalance = 0
  let totalDeposits = 0
  for (const row of assetRows) {
    totalBalance += row.latestBalance
    totalDeposits += row.sumDeposits
  }
  const plMoney = totalBalance - totalDeposits
  const plPercent = totalDeposits > 0 ? (plMoney / totalDeposits) * 100 : null

  const allLogs = [...logs]
  const mm = minMaxPeriod(allLogs)
  const balanceOverTime: DashboardTimePoint[] = []
  const cumulativeDepositsOverTime: DashboardTimePoint[] = []
  const portfolioMonthlyReturnPercent: DashboardTimePoint[] = []
  const depositsByMonth: DashboardDepositsByMonth[] = []
  const plOverTime: DashboardPlOverTimePoint[] = []
  const heatmapMonthLabels: string[] = []
  const heatmapRows: DashboardHeatmapRow[] = []

  if (mm != null) {
    const months = enumerateMonthsInclusive(mm.min, mm.max)
    const beforeFirst =
      mm.min.month === 1 ? { year: mm.min.year - 1, month: 12 } : { year: mm.min.year, month: mm.min.month - 1 }

    let prevPortfolioEnd = 0
    for (const a of assets) {
      const lg = sortLogsAsc(byAsset.get(a.id) ?? [])
      prevPortfolioEnd += carriedBalanceAtEndOfMonth(lg, beforeFirst.year, beforeFirst.month)
    }

    let cumDeposits = 0
    for (const { year, month } of months) {
      const t = periodToTime(year, month)
      heatmapMonthLabels.push(t)

      let currPortfolioEnd = 0
      let depositsThisMonth = 0
      const stackSlices: DashboardDepositStackSlice[] = []
      for (const a of assets) {
        const lg = sortLogsAsc(byAsset.get(a.id) ?? [])
        const d = depositInMonth(lg, year, month)
        depositsThisMonth += d
        if (d !== 0) stackSlices.push({ assetId: a.id, name: a.name, color: a.color, deposit: d })
        currPortfolioEnd += carriedBalanceAtEndOfMonth(lg, year, month)
      }

      cumDeposits += depositsThisMonth
      cumulativeDepositsOverTime.push({ time: t, value: cumDeposits })
      balanceOverTime.push({ time: t, value: currPortfolioEnd })

      const moneyPL = currPortfolioEnd - prevPortfolioEnd - depositsThisMonth
      const startBase = prevPortfolioEnd + depositsThisMonth
      const pct = startBase > 0 ? (moneyPL / startBase) * 100 : 0
      portfolioMonthlyReturnPercent.push({ time: t, value: pct })

      depositsByMonth.push({ time: t, total: depositsThisMonth, byAsset: stackSlices })
      const plMoneyNow = currPortfolioEnd - cumDeposits
      const plPercentNow = cumDeposits > 0 ? (plMoneyNow / cumDeposits) * 100 : null
      plOverTime.push({ time: t, plMoney: plMoneyNow, plPercent: plPercentNow })

      prevPortfolioEnd = currPortfolioEnd
    }

    for (const a of assets) {
      const lg = sortLogsAsc(byAsset.get(a.id) ?? [])
      const pctValues = months.map(({ year, month }) => monthlyPctForAssetMonth(lg, year, month))
      heatmapRows.push({ assetId: a.id, name: a.name, color: a.color, pctValues })
    }
  }

  const dataHealth: DashboardDataHealthAsset[] = assets.map((a) => {
    const lg = sortLogsAsc(byAsset.get(a.id) ?? [])
    if (lg.length === 0)
      return {
        assetId: a.id,
        name: a.name,
        color: a.color,
        hasLogs: false,
        firstLogPeriod: null,
        latestLogPeriod: null,
        missingMonthsInRange: 0,
        missingSample: [],
      }
    const bounds = minMaxPeriod(lg)
    if (bounds == null)
      return {
        assetId: a.id,
        name: a.name,
        color: a.color,
        hasLogs: false,
        firstLogPeriod: null,
        latestLogPeriod: null,
        missingMonthsInRange: 0,
        missingSample: [],
      }
    const missing = missingMonthsInLoggedRange(lg)
    return {
      assetId: a.id,
      name: a.name,
      color: a.color,
      hasLogs: true,
      firstLogPeriod: periodToTime(bounds.min.year, bounds.min.month),
      latestLogPeriod: periodToTime(bounds.max.year, bounds.max.month),
      missingMonthsInRange: missing.length,
      missingSample: missing.slice(0, 6),
    }
  })

  const distTotal = assetRows.reduce((s, r) => s + Math.max(0, r.latestBalance), 0)
  const distribution: DashboardAssetSlice[] = assetRows.map((r) => ({
    assetId: r.id,
    name: r.name,
    color: r.color,
    latestBalance: r.latestBalance,
    weight: distTotal > 0 ? Math.max(0, r.latestBalance) / distTotal : 0,
  }))

  return {
    totals: {
      totalBalance,
      totalDeposits,
      plMoney,
      plPercent,
    },
    balanceOverTime,
    cumulativeDepositsOverTime,
    portfolioMonthlyReturnPercent,
    depositsByMonth,
    plOverTime,
    heatmapMonthLabels,
    heatmapRows,
    distribution,
    assets: assetRows,
    dataHealth,
  }
}
