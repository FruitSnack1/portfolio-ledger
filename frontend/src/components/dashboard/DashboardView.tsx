import { useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { type AssetLogStats, gainMoneyStatToneClass, percentPLStatToneClass } from '../../asset/assetLogStats'
import { defaultChartGainLossColors } from '../../asset/logMonthlyPerformanceSeries'
import { BalanceOverTimeChart } from '../charts/BalanceOverTimeChart'
import { HistogramBarChart } from '../charts/HistogramBarChart'
import { formatDisplayMoney, formatSignedDisplayMoney } from '../../currency/formatDisplayMoney'
import { AssetDistributionDonut } from './AssetDistributionDonut'
import { DashboardContributionBars } from './DashboardContributionBars'
import { DashboardDataHealthStrip } from './DashboardDataHealthStrip'
import { DashboardHeatmap } from './DashboardHeatmap'
import type { DashboardPayload } from './dashboardTypes'
import { DepositsStackedByMonthChart } from './DepositsStackedByMonthChart'
import { DualLinePortfolioChart } from './DualLinePortfolioChart'
import { PlOverTimeCharts } from './PlOverTimeCharts'
import { PortfolioAssetPctLinesChart, type AssetPctSeries } from './PortfolioAssetPctLinesChart'

export type { DashboardPayload } from './dashboardTypes'

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

const PORTFOLIO_BALANCE_LINE = '#64748b'
const PORTFOLIO_CUMULATIVE_DEPOSITS_LINE = '#0ea5e9'

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
  const cumulativeDeposits = data.cumulativeDepositsOverTime ?? []
  const portfolioReturnPct = data.portfolioMonthlyReturnPercent ?? []
  const depositsByMonth = data.depositsByMonth ?? []
  const plOverTime = data.plOverTime ?? []
  const heatmapMonthLabels = data.heatmapMonthLabels ?? []
  const heatmapRows = data.heatmapRows ?? []
  const dataHealth = data.dataHealth ?? []

  const portfolioReturnHistogramPoints = useMemo(() => {
    const colors = defaultChartGainLossColors(theme)
    return portfolioReturnPct.map((p) => ({
      time: p.time,
      value: p.value,
      color: p.value > 0 ? colors.pos : p.value < 0 ? colors.neg : colors.neutral,
    }))
  }, [portfolioReturnPct, theme])

  const formatPctHistogram = useCallback((n: number) => {
    if (!Number.isFinite(n)) return '—'
    const sign = n > 0 ? '+' : ''
    return `${sign}${n.toFixed(2)}%`
  }, [])

  const formatMoneyAxis = useCallback((n: number) => formatDisplayMoney(n, displayCurrency), [displayCurrency])

  const formatPlMoneyAxis = useCallback((n: number) => formatDisplayMoney(n, displayCurrency), [displayCurrency])

  const dualLineReady =
    balancePoints.length > 0 && cumulativeDeposits.length > 0 && balancePoints.length === cumulativeDeposits.length

  const contributionRows = useMemo(
    () => data.assets.filter((a) => a.plMoney !== 0 || a.sumDeposits > 0 || a.latestBalance !== 0),
    [data.assets],
  )

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

      {dataHealth.length > 0 && <DashboardDataHealthStrip items={dataHealth} />}

      {balancePoints.length > 0 && (
        <section className="card dashboard-chart-card">
          <h2 className="card-title">Total balance over time</h2>
          <p className="asset-detail-lead">Sum of each asset’s carried month-end balance (from your logs).</p>
          <BalanceOverTimeChart points={balancePoints} lineColor={PORTFOLIO_BALANCE_LINE} displayCurrency={displayCurrency} />
        </section>
      )}

      {dualLineReady && (
        <section className="card dashboard-chart-card">
          <h2 className="card-title">Cumulative deposits vs total balance</h2>
          <p className="asset-detail-lead">
            Running sum of all deposits across assets vs portfolio balance each month — money in vs where the portfolio stands.
          </p>
          <DualLinePortfolioChart
            seriesA={{
              points: balancePoints,
              color: PORTFOLIO_BALANCE_LINE,
              label: 'Total balance',
            }}
            seriesB={{
              points: cumulativeDeposits,
              color: PORTFOLIO_CUMULATIVE_DEPOSITS_LINE,
              label: 'Cumulative deposits',
            }}
            formatPrice={formatMoneyAxis}
            resolvedTheme={theme}
          />
        </section>
      )}

      {portfolioReturnHistogramPoints.length > 0 && (
        <section className="card dashboard-chart-card">
          <h2 className="card-title">Portfolio monthly return</h2>
          <p className="asset-detail-lead">
            Month-over-month % on the whole portfolio: same idea as each asset (change in total balance vs prior month-end and
            this month’s deposits).
          </p>
          <HistogramBarChart points={portfolioReturnHistogramPoints} formatPrice={formatPctHistogram} resolvedTheme={theme} height={240} />
        </section>
      )}

      {depositsByMonth.length > 0 && (
        <section className="card dashboard-chart-card">
          <h2 className="card-title">Deposits by month</h2>
          <p className="asset-detail-lead">Sum of deposits logged in each month, stacked by asset (newest at top).</p>
          <DepositsStackedByMonthChart
            rows={depositsByMonth}
            displayCurrency={displayCurrency}
            formatMoney={formatDisplayMoney}
          />
        </section>
      )}

      {plOverTime.length > 0 && (
        <section className="card dashboard-chart-card">
          <h2 className="card-title">P/L over time</h2>
          <p className="asset-detail-lead">How total balance minus cumulative deposits evolves month by month.</p>
          <PlOverTimeCharts points={plOverTime} formatMoney={formatPlMoneyAxis} resolvedTheme={theme} />
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
                    <span className="dashboard-donut-legend-pct muted">{(d.weight * 100).toFixed(1)}%</span>
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

      {contributionRows.length > 0 && (
        <section className="card dashboard-chart-card">
          <h2 className="card-title">Contribution to portfolio P/L</h2>
          <p className="asset-detail-lead">Each asset’s total P/L (latest balance minus sum of deposits), scaled to the largest absolute contributor.</p>
          <DashboardContributionBars
            assets={data.assets}
            formatSignedMoney={(n) => formatSignedDisplayMoney(n, displayCurrency)}
          />
        </section>
      )}

      {heatmapMonthLabels.length > 0 && heatmapRows.length > 0 && (
        <section className="card dashboard-chart-card">
          <h2 className="card-title">Monthly % by asset</h2>
          <p className="asset-detail-lead">Month-over-month % return where a log exists; em dash when there is no row that month.</p>
          <DashboardHeatmap monthLabels={heatmapMonthLabels} rows={heatmapRows} />
        </section>
      )}

      {pctSeries.some((s) => s.points.length > 0) && (
        <section className="card dashboard-chart-card">
          <h2 className="card-title">Monthly % change by asset (lines)</h2>
          <p className="asset-detail-lead">Each line is that asset’s month-over-month % return (same basis as on the asset page).</p>
          <PortfolioAssetPctLinesChart seriesList={pctSeries} resolvedTheme={theme} />
        </section>
      )}
    </div>
  )
}
