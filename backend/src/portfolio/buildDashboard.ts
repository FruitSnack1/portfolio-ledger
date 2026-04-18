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

export type DashboardPayload = {
  totals: {
    totalBalance: number
    totalDeposits: number
    plMoney: number
    plPercent: number | null
  }
  balanceOverTime: DashboardTimePoint[]
  distribution: DashboardAssetSlice[]
  assets: DashboardAssetRow[]
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
  if (mm != null) {
    const months = enumerateMonthsInclusive(mm.min, mm.max)
    for (const { year, month } of months) {
      let sum = 0
      for (const a of assets) {
        const lg = sortLogsAsc(byAsset.get(a.id) ?? [])
        sum += carriedBalanceAtEndOfMonth(lg, year, month)
      }
      balanceOverTime.push({ time: periodToTime(year, month), value: sum })
    }
  }

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
    distribution,
    assets: assetRows,
  }
}
