import { type FormEvent, useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ASSET_COLOR_PRESETS, DEFAULT_ASSET_COLOR } from '../asset/assetColorPalette'
import { formatPercentPLStat, percentPLStatToneClass, type AssetLogStats } from '../asset/assetLogStats'
import { ApiError, apiJson } from '../api/client'
import { formatDisplayMoneyFromString } from '../currency/formatDisplayMoney'
import { AssetColorPresets } from '../components/AssetColorPresets'

export type AssetListSummary = {
  hasLogs: boolean
  currentBalance: string | null
  sumDeposits: number
  percentPL: number | null
}

export type AssetRow = {
  id: string
  name: string
  color: string
  createdAt: string
  withdrawn: boolean
  summary?: AssetListSummary
}

const DEFAULT_ASSET_SUMMARY: AssetListSummary = {
  hasLogs: false,
  currentBalance: null,
  sumDeposits: 0,
  percentPL: null,
}

/** Maps API list summary to stats helpers (balance / P/L % display). */
function summaryToStats(summary: AssetListSummary): AssetLogStats {
  const balanceNum = summary.currentBalance != null ? Number(summary.currentBalance) : null
  const balOk = balanceNum != null && Number.isFinite(balanceNum)
  return {
    hasLogs: summary.hasLogs,
    currentBalance: balOk ? balanceNum : null,
    sumDeposits: summary.sumDeposits,
    gain: summary.hasLogs && balOk ? balanceNum - summary.sumDeposits : null,
    percentPL: summary.percentPL,
  }
}

function assetColorLabel(hex: string) {
  const preset = ASSET_COLOR_PRESETS.find((p) => p.hex === hex.toUpperCase())
  if (preset) return `${preset.label} (${preset.hex})`
  return hex
}

function AssetListStatsRow({
  summary,
  displayCurrency,
}: {
  summary: AssetListSummary
  displayCurrency: string | null
}) {
  const stats = summaryToStats(summary)
  const balanceLabel =
    summary.hasLogs && summary.currentBalance != null
      ? formatDisplayMoneyFromString(summary.currentBalance, displayCurrency)
      : '—'
  return (
    <div className="asset-list-stats" aria-label="Balance and return">
      <span className="muted asset-list-stat-amount">{balanceLabel}</span>
      <span className={`asset-list-stat-pl${percentPLStatToneClass(stats)}`}>{formatPercentPLStat(stats)}</span>
    </div>
  )
}

export function AssetsPage() {
  const navigate = useNavigate()
  const [assets, setAssets] = useState<AssetRow[]>([])
  const [loadState, setLoadState] = useState<'loading' | 'ok' | 'error'>('loading')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [color, setColor] = useState(DEFAULT_ASSET_COLOR)
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [displayCurrency, setDisplayCurrency] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void apiJson<{ user: { displayCurrency: string | null } }>('/api/auth/me')
      .then((data) => {
        if (!cancelled) setDisplayCurrency(data.user.displayCurrency)
      })
      .catch(() => {
        if (!cancelled) setDisplayCurrency(null)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const load = useCallback(async () => {
    setLoadError(null)
    setLoadState('loading')
    try {
      const data = await apiJson<{ assets: AssetRow[] }>('/api/assets')
      const sorted = [...data.assets].sort((a, b) => {
        const aw = a.withdrawn ? 1 : 0
        const bw = b.withdrawn ? 1 : 0
        if (aw !== bw) return aw - bw
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      })
      setAssets(sorted)
      setLoadState('ok')
    } catch (e: unknown) {
      if (e instanceof ApiError && e.status === 401) {
        void navigate('/login', { replace: true })
        return
      }
      if (e instanceof ApiError) setLoadError(`${e.message} (HTTP ${e.status})`)
      else if (e instanceof TypeError) setLoadError('Could not reach the API. Is the backend running?')
      else setLoadError('Something went wrong')
      setLoadState('error')
    }
  }, [navigate])

  useEffect(() => {
    void load()
  }, [load])

  async function onCreate(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    setSaving(true)
    try {
      const res = await apiJson<{ asset: AssetRow }>('/api/assets', {
        method: 'POST',
        body: JSON.stringify({ name: name.trim(), color }),
      })
      setAssets((prev) => [res.asset, ...prev])
      setName('')
      setColor(DEFAULT_ASSET_COLOR)
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 401) {
        void navigate('/login', { replace: true })
        return
      }
      if (err instanceof ApiError) setFormError(err.message)
      else setFormError('Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  if (loadState === 'loading') return <main className="app">Loading assets…</main>

  if (loadState === 'error')
    return (
      <main className="app">
        <p className="error">{loadError ?? 'Could not load assets.'}</p>
        <button type="button" className="btn" onClick={() => void load()}>
          Retry
        </button>
      </main>
    )

  return (
    <main className="app assets-page">
      <p className="page-back">
        <Link to="/">← Home</Link>
      </p>

      <div className="assets-page-heading">
        <div>
          <h1 className="assets-page-title">Assets</h1>
          <p className="muted">Only you can see assets on this account. Click an asset to open its page.</p>
        </div>
      </div>

      <div className="assets-layout">
        <section className="card asset-form-card">
          <h2 className="card-title">New asset</h2>
          <form className="form" onSubmit={(ev) => void onCreate(ev)}>
            <label className="field">
              <span>Name</span>
              <input value={name} onChange={(ev) => setName(ev.target.value)} required maxLength={120} placeholder="e.g. S&P 500 ETF" />
            </label>
            <div className="field">
              <span>Color</span>
              <p className="hint color-hint">Pick a preset — these stay consistent for charts.</p>
              <AssetColorPresets value={color} onChange={setColor} groupLabel="New asset color" />
            </div>
            {formError != null && <p className="error">{formError}</p>}
            <button type="submit" className="btn primary" disabled={saving}>
              {saving ? 'Saving…' : 'Create asset'}
            </button>
          </form>
        </section>

        <section className="asset-list-section">
          <h2 className="card-title">Your assets</h2>
          {assets.length === 0 ? (
            <p className="muted">No assets yet. Create one with the form.</p>
          ) : (
            <ul className="asset-list">
              {assets.map((a) => (
                <li key={a.id}>
                  <Link
                    to={`/assets/${a.id}`}
                    className={`asset-card asset-card--link${a.withdrawn ? ' asset-card--withdrawn' : ''}`}
                  >
                    <span className="asset-swatch" style={{ backgroundColor: a.color }} title={assetColorLabel(a.color)} />
                    <div className="asset-meta">
                      <div className="asset-meta-top">
                        <span className="asset-name">{a.name}</span>
                        {a.withdrawn ? <span className="asset-withdrawn-pill">Withdrawn</span> : null}
                      </div>
                      <AssetListStatsRow summary={a.summary ?? DEFAULT_ASSET_SUMMARY} displayCurrency={displayCurrency} />
                    </div>
                    <span className="asset-card-chevron" aria-hidden>
                      →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  )
}
