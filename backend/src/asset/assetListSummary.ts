import { formatDbNumericStringForClient } from './formatDbNumericString.js'

export type AssetListSummary = {
  hasLogs: boolean
  currentBalance: string | null
  sumDeposits: number
  percentPL: number | null
}

type LogInput = { year: number; month: number; deposit: string; balance: string }

/** Mirrors frontend `computeAssetLogStats` for list aggregation. */
export function computeAssetListSummaryForLogs(logs: readonly LogInput[]): AssetListSummary {
  if (logs.length === 0)
    return { hasLogs: false, currentBalance: null, sumDeposits: 0, percentPL: null }

  let sumDeposits = 0
  for (const row of logs) {
    const d = Number(row.deposit)
    if (Number.isFinite(d)) sumDeposits += d
  }

  const sorted = [...logs].sort((a, b) => {
    if (b.year !== a.year) return b.year - a.year
    return b.month - a.month
  })
  const latest = sorted[0]
  const currentBalanceNum = Number(latest.balance)
  const currentBalance = Number.isFinite(currentBalanceNum) ? formatDbNumericStringForClient(latest.balance) : null

  const percentPL =
    sumDeposits > 0 && Number.isFinite(currentBalanceNum)
      ? ((currentBalanceNum - sumDeposits) / sumDeposits) * 100
      : null

  return {
    hasLogs: true,
    currentBalance,
    sumDeposits,
    percentPL,
  }
}
