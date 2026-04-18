import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { type AssetLogStats, gainMoneyStatToneClass, percentPLStatToneClass } from '../../asset/assetLogStats'
import { BalanceOverTimeChart } from '../charts/BalanceOverTimeChart'
import { formatDisplayMoney, formatSignedDisplayMoney } from '../../currency/formatDisplayMoney'
import { AssetDistributionDonut } from './AssetDistributionDonut'
import { PortfolioAssetPctLinesChart, type AssetPctSeries } from './PortfolioAssetPctLinesChart'

export type DashboardPayload = {
  totals: {
    totalBalance: number
    totalDeposits: number
    plMoney: number
    plPercent: number | null
  }
  balanceOverTime: { time: string; value: number }[]
  distribution: { assetId: string; name: string; color: string; latestBalance: number; weight: number }[]
  assets: {
    id: string
    name: string
    color: string
    sumDeposits: number
    latestBalance: number
    plMoney: number
    plPercent: number | null
    monthlyPercentPoints: { time: string; value: number }[]
  }[]
}

function formatPctValue(p: number | null): string {
  if (p == null || !Number.isFinite(p)) return '—'
  const sign = p > 0 ? '+' : ''
  return `${sign}${p.toFixed(2)}%`
}

function statsFromTotals(totals: DashboardPayload['totals']): AssetLogStats {
  const hasLogs = totals.totalDeposits > 0 || totals.totalBalance !== 0
  return {
    hasLogs,
    currentBalance: totals.totalBalance,
    sumDeposits: totals.totalDeposits,
    gain: totals.plMoney,
    percentPL: totals.plPercent,
  }
}

type DashboardViewProps = {
  data: DashboardPayload
  displayCurrency: string | null
  theme: 'light' | 'dark'
}

const PORTFOLIO_CHART_LINE = '#64748b'

export function DashboardView({ data, displayCurrency, theme }: DashboardViewProps) {
  const totalsStats = useMemo(() => statsFromTotals(data.totals), [data.totals])
  const pctSeries: AssetPctSeries[] = useMemo(
    () =>
      data.assets.map((a) => ({
        id: a.id,
        name: a.name,
        color: a.color,
        points: a.monthlyPercentPoints,
      })),
    [data.assets],
  )

  const donutSlices = useMemo(
    () => data.distribution.map((d) => ({ name: d.name, color: d.color, value: d.latestBalance })),
    [data.distribution],
  )

  const balancePoints = data.balanceOverTime

  return (
    <div className="dashboard-view">
      <section className="dashboard-stats" aria-label="Portfolio totals">
        <div className="asset-detail-stat">
          <span className="asset-detail-stat-label">Total balance</span>
          <span className="asset-detail-stat-value">{formatDisplayMoney(data.totals.totalBalance, displayCurrency)}</span>
        </div>
        <div className="asset-detail-stat">
          <span className="asset-detail-stat-label">Portfolio P/L</span>
          <span className={`asset-detail-stat-value${gainMoneyStatToneClass(totalsStats)}`}>
            {formatSignedDisplayMoney(data.totals.plMoney, displayCurrency)}
          </span>
        </div>
        <div className="asset-detail-stat">
          <span className="asset-detail-stat-label">Portfolio P/L %</span>
          <span className={`asset-detail-stat-value${percentPLStatToneClass(totalsStats)}`}>
            {formatPctValue(data.totals.plPercent)}
          </span>
        </div>
      </section>

      {balancePoints.length > 0 && (
        <section className="card dashboard-chart-card">
          <h2 className="card-title">Total balance over time</h2>
          <p className="asset-detail-lead">Sum of each asset’s carried month-end balance (from your logs).</p>
          <BalanceOverTimeChart points={balancePoints} lineColor={PORTFOLIO_CHART_LINE} displayCurrency={displayCurrency} />
        </section>
      )}

      <div className="dashboard-donut-table">
        <section className="card dashboard-donut-card">
          <h2 className="card-title">By asset</h2>
          <p className="asset-detail-lead">Share of latest balance.</p>
          <div className="dashboard-donut-inner">
            <AssetDistributionDonut slices={donutSlices} />
            <ul className="dashboard-donut-legend">
              {data.distribution.map((d) =>
                d.latestBalance <= 0 ? null : (
                  <li key={d.assetId}>
                    <span className="portfolio-pct-legend-swatch" style={{ backgroundColor: d.color }} />
                    <span className="dashboard-donut-legend-name">{d.name}</span>
                    <span className="dashboard-donut-legend-pct muted">
                      {(d.weight * 100).toFixed(1)}%
                    </span>
                  </li>
                ),
              )}
            </ul>
          </div>
        </section>

        <section className="card dashboard-table-card">
          <h2 className="card-title">Assets</h2>
          <div className="table-wrap">
            <table className="logs-table dashboard-assets-table">
              <thead>
                <tr>
                  <th>Asset</th>
                  <th className="logs-table__num">Deposits</th>
                  <th className="logs-table__num">Balance</th>
                  <th className="logs-table__num">P/L %</th>
                  <th className="logs-table__num">P/L</th>
                </tr>
              </thead>
              <tbody>
                {data.assets.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="muted">
                      No assets yet.{' '}
                      <Link to="/assets">Create assets</Link> to see them here.
                    </td>
                  </tr>
                ) : (
                  data.assets.map((a) => {
                    const rowStats: AssetLogStats = {
                      hasLogs: a.sumDeposits > 0 || a.latestBalance !== 0,
                      currentBalance: a.latestBalance,
                      sumDeposits: a.sumDeposits,
                      gain: a.plMoney,
                      percentPL: a.plPercent,
                    }
                    return (
                      <tr key={a.id}>
                        <td>
                          <Link to={`/assets/${a.id}`} className="dashboard-asset-link">
                            <span className="asset-swatch" style={{ backgroundColor: a.color }} title={a.name} />
                            {a.name}
                          </Link>
                        </td>
                        <td className="logs-table__num">{formatDisplayMoney(a.sumDeposits, displayCurrency)}</td>
                        <td className="logs-table__num">{formatDisplayMoney(a.latestBalance, displayCurrency)}</td>
                        <td className={`logs-table__num${percentPLStatToneClass(rowStats)}`}>{formatPctValue(a.plPercent)}</td>
                        <td className={`logs-table__num${gainMoneyStatToneClass(rowStats)}`}>
                          {formatSignedDisplayMoney(a.plMoney, displayCurrency)}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {pctSeries.some((s) => s.points.length > 0) && (
        <section className="card dashboard-chart-card">
          <h2 className="card-title">Monthly % change by asset</h2>
          <p className="asset-detail-lead">Each line is that asset’s month-over-month % return (same basis as on the asset page).</p>
          <PortfolioAssetPctLinesChart seriesList={pctSeries} resolvedTheme={theme} />
        </section>
      )}
    </div>
  )
}
