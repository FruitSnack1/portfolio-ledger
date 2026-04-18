import { Link } from 'react-router-dom'
import type { DashboardHeatmapRow } from './dashboardTypes'

type DashboardHeatmapProps = {
  monthLabels: readonly string[]
  rows: readonly DashboardHeatmapRow[]
}

function monthShort(isoMonth: string) {
  if (isoMonth.length < 7) return isoMonth
  return isoMonth.slice(0, 7)
}

function cellClass(pct: number | null): string {
  if (pct == null || !Number.isFinite(pct)) return 'dashboard-heatmap-cell dashboard-heatmap-cell--empty'
  if (pct >= 3) return 'dashboard-heatmap-cell dashboard-heatmap-cell--pos-strong'
  if (pct > 0) return 'dashboard-heatmap-cell dashboard-heatmap-cell--pos'
  if (pct <= -3) return 'dashboard-heatmap-cell dashboard-heatmap-cell--neg-strong'
  if (pct < 0) return 'dashboard-heatmap-cell dashboard-heatmap-cell--neg'
  return 'dashboard-heatmap-cell dashboard-heatmap-cell--neutral'
}

function cellTitle(name: string, month: string, pct: number | null) {
  if (pct == null || !Number.isFinite(pct)) return `${name} · ${month}: —`
  const sign = pct > 0 ? '+' : ''
  return `${name} · ${month}: ${sign}${pct.toFixed(2)}%`
}

export function DashboardHeatmap({ monthLabels, rows }: DashboardHeatmapProps) {
  if (monthLabels.length === 0 || rows.length === 0) return null

  return (
    <div className="dashboard-heatmap-scroll">
      <table className="dashboard-heatmap">
        <thead>
          <tr>
            <th className="dashboard-heatmap-sticky">Asset</th>
            {monthLabels.map((m) => (
              <th key={m} className="dashboard-heatmap-month">
                {monthShort(m)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.assetId}>
              <th className="dashboard-heatmap-sticky">
                <Link to={`/assets/${r.assetId}`} className="dashboard-heatmap-asset">
                  <span className="asset-swatch" style={{ backgroundColor: r.color }} aria-hidden />
                  <span className="dashboard-heatmap-asset-name">{r.name}</span>
                </Link>
              </th>
              {r.pctValues.map((pct, i) => {
                const m = monthLabels[i] ?? ''
                return (
                  <td key={m + i} className={cellClass(pct)} title={cellTitle(r.name, m, pct)}>
                    {pct != null && Number.isFinite(pct) ? `${pct > 0 ? '+' : ''}${pct.toFixed(0)}` : '—'}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
