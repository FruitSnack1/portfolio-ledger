import { Link } from 'react-router-dom'
import type { DashboardAssetRow } from './dashboardTypes'

type DashboardContributionBarsProps = {
  assets: readonly DashboardAssetRow[]
  formatSignedMoney: (n: number) => string
}

export function DashboardContributionBars({ assets, formatSignedMoney }: DashboardContributionBarsProps) {
  const withPl = assets.filter((a) => a.plMoney !== 0 || a.sumDeposits > 0 || a.latestBalance !== 0)
  if (withPl.length === 0) return null

  const maxAbs = Math.max(...withPl.map((a) => Math.abs(a.plMoney)), 1e-9)
  const sorted = [...withPl].sort((a, b) => Math.abs(b.plMoney) - Math.abs(a.plMoney))

  return (
    <ul className="dashboard-contrib-bars" aria-label="Contribution to portfolio P/L">
      {sorted.map((a) => {
        const w = (Math.abs(a.plMoney) / maxAbs) * 100
        const pos = a.plMoney >= 0
        return (
          <li key={a.id} className="dashboard-contrib-row">
            <Link to={`/assets/${a.id}`} className="dashboard-contrib-name">
              <span className="asset-swatch" style={{ backgroundColor: a.color }} title={a.name} />
              {a.name}
            </Link>
            <div className="dashboard-contrib-track">
              <div
                className={`dashboard-contrib-fill${pos ? ' dashboard-contrib-fill--pos' : ' dashboard-contrib-fill--neg'}`}
                style={{ width: `${w}%` }}
              />
            </div>
            <span className={`dashboard-contrib-value${pos ? ' dashboard-contrib-value--pos' : ' dashboard-contrib-value--neg'}`}>
              {formatSignedMoney(a.plMoney)}
            </span>
          </li>
        )
      })}
    </ul>
  )
}
