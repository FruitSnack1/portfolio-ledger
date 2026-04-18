/** Mirrors backend `DashboardPayload` fields used on the home dashboard. */
export type DashboardTotals = {
  totalBalance: number
  totalDeposits: number
  plMoney: number
  plPercent: number | null
}

export type DashboardTimePoint = { time: string; value: number }

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
  missingSample: string[]
}

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
  totals: DashboardTotals
  balanceOverTime: DashboardTimePoint[]
  cumulativeDepositsOverTime: DashboardTimePoint[]
  portfolioMonthlyReturnMoney: DashboardTimePoint[]
  portfolioMonthlyReturnPercent: DashboardTimePoint[]
  depositsByMonth: DashboardDepositsByMonth[]
  plOverTime: DashboardPlOverTimePoint[]
  heatmapMonthLabels: string[]
  heatmapRows: DashboardHeatmapRow[]
  distribution: DashboardAssetSlice[]
  assets: DashboardAssetRow[]
  dataHealth: DashboardDataHealthAsset[]
}
