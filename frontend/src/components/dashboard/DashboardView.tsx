import { useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { type AssetLogStats, gainMoneyStatToneClass, percentPLStatToneClass } from '../../asset/assetLogStats'
import { defaultChartGainLossColors } from '../../asset/logMonthlyPerformanceSeries'
import { HistogramBarChart } from '../charts/HistogramBarChart'
import { formatDisplayMoney, formatSignedDisplayMoney } from '../../currency/formatDisplayMoney'
import { AssetDistributionDonut } from './AssetDistributionDonut'
import type { DashboardPayload } from './dashboardTypes'
import { DualLinePortfolioChart } from './DualLinePortfolioChart'
import { PlOverTimeMoneyCandles, PortfolioMonthlyReturnCandles } from './PlOverTimeCharts'
import { PortfolioAssetPctLinesChart, type AssetPctSeries } from './PortfolioAssetPctLinesChart'
import {
  buildPortfolioYearQuarterRows,
  formatSignedPct2,
  signedReturnToneClass,
} from './portfolioYearQuarterReturns'

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

  const assetsTableRows = useMemo(
    () => [...data.assets].sort((a, b) => b.latestBalance - a.latestBalance),
    [data.assets],
  )

  const balancePoints = data.balanceOverTime
  const cumulativeDeposits = data.cumulativeDepositsOverTime ?? []
  const portfolioReturnMoney = data.portfolioMonthlyReturnMoney ?? []
  const portfolioMonthlyReturnPct = data.portfolioMonthlyReturnPercent ?? []
  const plOverTime = data.plOverTime ?? []

  const portfolioReturnHistogramPoints = useMemo(() => {
    const colors = defaultChartGainLossColors(theme)
    return portfolioReturnMoney.map((p) => ({
      time: p.time,
      value: p.value,
      color: p.value > 0 ? colors.pos : p.value < 0 ? colors.neg : colors.neutral,
    }))
  }, [portfolioReturnMoney, theme])

  const portfolioReturnPctHistogramPoints = useMemo(() => {
    const colors = defaultChartGainLossColors(theme)
    return portfolioMonthlyReturnPct.map((p) => ({
      time: p.time,
      value: p.value,
      color: p.value > 0 ? colors.pos : p.value < 0 ? colors.neg : colors.neutral,
    }))
  }, [portfolioMonthlyReturnPct, theme])

  const formatMoneyAxis = useCallback((n: number) => formatDisplayMoney(n, displayCurrency), [displayCurrency])

  const formatPlMoneyAxis = useCallback((n: number) => formatDisplayMoney(n, displayCurrency), [displayCurrency])

  const formatSignedMoneyAxis = useCallback(
    (n: number) => formatSignedDisplayMoney(n, displayCurrency),
    [displayCurrency],
  )

  const formatPctHistogram = useCallback((n: number) => {
    if (!Number.isFinite(n)) return '—'
    const sign = n > 0 ? '+' : ''
    return `${sign}${n.toFixed(2)}%`
  }, [])

  const dualLineReady =
    balancePoints.length > 0 && cumulativeDeposits.length > 0 && balancePoints.length === cumulativeDeposits.length

  const hasHist = portfolioReturnHistogramPoints.length > 0
  const showMonthlyPortfolioPctCandles = portfolioMonthlyReturnPct.length > 0
  const hasLowerCharts = plOverTime.length > 0 || pctSeries.some((s) => s.points.length > 0)

  const yearQuarterRows = useMemo(
    () => buildPortfolioYearQuarterRows(portfolioMonthlyReturnPct),
    [portfolioMonthlyReturnPct],
  )
  const showYearQuarterTable = yearQuarterRows.length > 0

  return (
    <div className="dashboard-view">
      <section className="dashboard-stats dashboard-stats--top" aria-label="Portfolio totals">
        <div className="asset-detail-stat">
          <span className="asset-detail-stat-label">Total balance</span>
          <span className="asset-detail-stat-value">
            {formatDisplayMoney(data.totals.totalBalance, displayCurrency)}
          </span>
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

      <div className="dashboard-triplet__pair">
          <section className="card dashboard-chart-card dashboard-donut-card">
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
                  {assetsTableRows.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="muted">
                        No assets yet. <Link to="/assets">Create assets</Link> to see them here.
                      </td>
                    </tr>
                  ) : (
                    assetsTableRows.map((a) => {
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
                          <td className={`logs-table__num${percentPLStatToneClass(rowStats)}`}>
                            {formatPctValue(a.plPercent)}
                          </td>
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

      {dualLineReady || showYearQuarterTable ? (
        <div className="dashboard-deposits-balance-pair">
          {dualLineReady ? (
            <section className="card dashboard-chart-card">
              <h2 className="card-title">Cumulative deposits vs total balance</h2>
              <p className="asset-detail-lead">
                Running sum of all deposits across assets vs portfolio balance each month — money in vs where the
                portfolio stands.
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
          ) : null}
          {showYearQuarterTable ? (
            <section className="card dashboard-table-card" aria-label="Portfolio return by year and quarter">
              <h2 className="card-title">Portfolio return by year &amp; quarter</h2>
              <p className="asset-detail-lead">
                Each cell compounds the portfolio’s month-over-month % returns for that period (same basis as the
                monthly return chart). Quarters only include months you have logs for; a short first or last quarter is
                still a meaningful sub-period return.
              </p>
              <div className="table-wrap">
                <table className="logs-table dashboard-year-qtr-table">
                  <thead>
                    <tr>
                      <th scope="col">Year</th>
                      <th scope="col" className="logs-table__num">
                        Q1
                      </th>
                      <th scope="col" className="logs-table__num">
                        Q2
                      </th>
                      <th scope="col" className="logs-table__num">
                        Q3
                      </th>
                      <th scope="col" className="logs-table__num">
                        Q4
                      </th>
                      <th scope="col" className="logs-table__num">
                        Year
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {yearQuarterRows.map((row) => (
                      <tr key={row.year}>
                        <th scope="row">{row.year}</th>
                        <td className={`logs-table__num${signedReturnToneClass(row.q1)}`}>
                          {formatSignedPct2(row.q1)}
                        </td>
                        <td className={`logs-table__num${signedReturnToneClass(row.q2)}`}>
                          {formatSignedPct2(row.q2)}
                        </td>
                        <td className={`logs-table__num${signedReturnToneClass(row.q3)}`}>
                          {formatSignedPct2(row.q3)}
                        </td>
                        <td className={`logs-table__num${signedReturnToneClass(row.q4)}`}>
                          {formatSignedPct2(row.q4)}
                        </td>
                        <td className={`logs-table__num${signedReturnToneClass(row.yearTotal)}`}>
                          {formatSignedPct2(row.yearTotal)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}
        </div>
      ) : null}

      {hasHist ? (
        <section className="card dashboard-chart-card">
          <h2 className="card-title">Portfolio monthly return</h2>
          <p className="asset-detail-lead">
            Month-over-month P/L in currency on the whole portfolio: change in total balance vs prior month-end and
            this month’s deposits (same basis as each asset’s monthly money return).
          </p>
          <HistogramBarChart
            points={portfolioReturnHistogramPoints}
            formatPrice={formatSignedMoneyAxis}
            resolvedTheme={theme}
            height={240}
          />
        </section>
      ) : null}

      {showMonthlyPortfolioPctCandles ? (
        <section className="card dashboard-chart-card">
          <h2 className="card-title">Same months, percent</h2>
          <p className="asset-detail-lead">
            The same periods as the money chart: each bar is that month’s portfolio return as a % of value at the start
            of the month (including deposits made that month).
          </p>
          <HistogramBarChart
            points={portfolioReturnPctHistogramPoints}
            formatPrice={formatPctHistogram}
            resolvedTheme={theme}
            height={220}
            symmetricZero
          />
        </section>
      ) : null}

      {hasLowerCharts ? (
        <div className="dashboard-charts-grid">
          {plOverTime.length > 0 ? (
            <section
              className={`card dashboard-chart-card${showMonthlyPortfolioPctCandles ? '' : ' dashboard-chart-card--span-2'}`}
            >
              <h2 className="card-title">P/L over time (money)</h2>
              <p className="asset-detail-lead">
                Total balance minus cumulative deposits each month. Each candle opens at the prior month’s P/L and
                closes at this month’s.
              </p>
              <PlOverTimeMoneyCandles points={plOverTime} formatMoney={formatPlMoneyAxis} resolvedTheme={theme} />
            </section>
          ) : null}
          {plOverTime.length > 0 && showMonthlyPortfolioPctCandles ? (
            <section className="card dashboard-chart-card">
              <h2 className="card-title">Portfolio monthly return % (candles)</h2>
              <p className="asset-detail-lead">
                Each month’s portfolio gain or loss as a percent (change in total balance vs prior month-end and this
                month’s deposits — not cumulative vs all-time deposits). Candle open is the prior month’s %, close is
                this month’s.
              </p>
              <PortfolioMonthlyReturnCandles series={portfolioMonthlyReturnPct} resolvedTheme={theme} />
            </section>
          ) : null}
          {pctSeries.some((s) => s.points.length > 0) ? (
            <section className="card dashboard-chart-card dashboard-chart-card--span-2">
              <h2 className="card-title">Monthly % change by asset (lines)</h2>
              <p className="asset-detail-lead">
                Each line is that asset’s month-over-month % return (same basis as on the asset page).
              </p>
              <PortfolioAssetPctLinesChart seriesList={pctSeries} resolvedTheme={theme} />
            </section>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
