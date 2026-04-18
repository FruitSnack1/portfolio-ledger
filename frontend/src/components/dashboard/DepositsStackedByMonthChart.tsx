import type { DashboardDepositsByMonth } from './dashboardTypes'

type DepositsStackedByMonthChartProps = {
  rows: readonly DashboardDepositsByMonth[]
  displayCurrency: string | null
  formatMoney: (n: number, currency: string | null) => string
}

export function DepositsStackedByMonthChart({ rows, displayCurrency, formatMoney }: DepositsStackedByMonthChartProps) {
  if (rows.length === 0) return null

  const ordered = [...rows].reverse()

  return (
    <ul className="deposits-stacked-chart" aria-label="Deposits by month">
      {ordered.map((row) => (
        <li key={row.time} className="deposits-stacked-row">
          <span className="deposits-stacked-month">{row.time.slice(0, 7)}</span>
          <div className="deposits-stacked-bar-wrap" title={formatMoney(row.total, displayCurrency)}>
            {row.total <= 0 ? (
              <div className="deposits-stacked-bar deposits-stacked-bar--empty" />
            ) : (
              <div className="deposits-stacked-bar">
                {row.byAsset.map((s) => {
                  const w = (s.deposit / row.total) * 100
                  if (w <= 0) return null
                  return (
                    <div
                      key={s.assetId}
                      className="deposits-stacked-seg"
                      style={{ width: `${w}%`, backgroundColor: s.color }}
                      title={`${s.name}: ${formatMoney(s.deposit, displayCurrency)}`}
                    />
                  )
                })}
              </div>
            )}
          </div>
          <span className="deposits-stacked-total muted">{formatMoney(row.total, displayCurrency)}</span>
        </li>
      ))}
    </ul>
  )
}
