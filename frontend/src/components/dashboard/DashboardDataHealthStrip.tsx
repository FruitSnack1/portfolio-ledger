import { Link } from 'react-router-dom'
import type { DashboardDataHealthAsset } from './dashboardTypes'

type DashboardDataHealthStripProps = {
  items: readonly DashboardDataHealthAsset[]
}

function formatMonthLabel(iso: string) {
  if (iso.length < 10) return iso
  return iso.slice(0, 7)
}

export function DashboardDataHealthStrip({ items }: DashboardDataHealthStripProps) {
  if (items.length === 0) return null

  return (
    <section className="dashboard-data-health" aria-label="Log data health">
      <h2 className="dashboard-data-health-title">Data health</h2>
      <p className="muted dashboard-data-health-lead">
        Latest log month per asset and gaps inside each asset’s logged range. Avoid reading flat portfolio lines as “no volatility” when some assets have not been updated.
      </p>
      <ul className="dashboard-data-health-list">
        {items.map((h) => (
          <li key={h.assetId} className="dashboard-data-health-card">
            <Link to={`/assets/${h.assetId}`} className="dashboard-data-health-head">
              <span className="asset-swatch" style={{ backgroundColor: h.color }} aria-hidden />
              <span className="dashboard-data-health-name">{h.name}</span>
            </Link>
            {!h.hasLogs ? (
              <p className="dashboard-data-health-status dashboard-data-health-status--warn">No logs yet</p>
            ) : (
              <>
                <p className="dashboard-data-health-status">
                  <span className="muted">Range</span>{' '}
                  {formatMonthLabel(h.firstLogPeriod ?? '')} → {formatMonthLabel(h.latestLogPeriod ?? '')}
                </p>
                {h.missingMonthsInRange > 0 ? (
                  <p className="dashboard-data-health-status dashboard-data-health-status--warn">
                    {h.missingMonthsInRange} missing month{h.missingMonthsInRange === 1 ? '' : 's'} in that window
                    {h.missingSample.length > 0 ? ` (e.g. ${h.missingSample.map(formatMonthLabel).join(', ')})` : ''}
                  </p>
                ) : (
                  <p className="dashboard-data-health-status dashboard-data-health-status--ok">No gaps in logged range</p>
                )}
              </>
            )}
          </li>
        ))}
      </ul>
      <p className="muted dashboard-data-health-foot">
        <Link to="/logs">All logs</Link> · <Link to="/assets">Assets</Link>
      </p>
    </section>
  )
}
