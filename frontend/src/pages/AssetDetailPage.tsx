import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  computeAssetLogStats,
  formatPercentPLStat,
  gainMoneyStatToneClass,
  percentPLStatToneClass,
} from '../asset/assetLogStats'
import { ASSET_COLOR_PRESETS, DEFAULT_ASSET_COLOR } from '../asset/assetColorPalette'
import { ApiError, apiJson } from '../api/client'
import {
  formatDisplayMoney,
  formatDisplayMoneyFromString,
  formatSignedDisplayMoney,
} from '../currency/formatDisplayMoney'
import { BalanceOverTimeChart } from '../components/charts/BalanceOverTimeChart'
import { HistogramBarChart } from '../components/charts/HistogramBarChart'
import { AssetColorPresets } from '../components/AssetColorPresets'
import { ConfirmModal } from '../components/ConfirmModal'
import { balanceOverTimePointsAsc } from '../asset/logBalanceTimeSeries'
import { defaultChartGainLossColors, monthlyPerformanceHistogramAsc } from '../asset/logMonthlyPerformanceSeries'
import { useTheme } from '../theme/ThemeProvider'
import type { AssetRow } from './AssetsPage'

type AssetSummary = { id: string; name: string; color: string; createdAt: string }

type AssetLogRow = {
  id: string
  year: number
  month: number
  deposit: string
  balance: string
  createdAt: string
}

const MONTH_OPTIONS = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
] as const

function formatAssetDate(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString(undefined, { dateStyle: 'medium' })
}

function formatNumericForInput(raw: string) {
  const n = Number(raw)
  if (!Number.isFinite(n)) return raw
  return String(n)
}

function normalizePresetColor(hex: string) {
  const u = hex.toUpperCase()
  if (ASSET_COLOR_PRESETS.some((p) => p.hex === u)) return u
  return DEFAULT_ASSET_COLOR
}

function depositBalanceFromLatestLog(logs: AssetLogRow[]) {
  if (logs.length === 0) return { deposit: '', balance: '' }
  const latest = logs[0]
  return {
    deposit: formatNumericForInput(latest.deposit),
    balance: formatNumericForInput(latest.balance),
  }
}

function applyCurrentPeriodAndLatestDefaults(
  logs: AssetLogRow[],
  setYear: (y: number) => void,
  setMonth: (m: number) => void,
  setDeposit: (d: string) => void,
  setBalance: (b: string) => void,
) {
  const now = new Date()
  setYear(now.getFullYear())
  setMonth(now.getMonth() + 1)
  const fromLatest = depositBalanceFromLatestLog(logs)
  setDeposit(fromLatest.deposit)
  setBalance(fromLatest.balance)
}

function formatLogPeriod(year: number, month: number) {
  const label = MONTH_OPTIONS.find((m) => m.value === month)?.label ?? String(month)
  return `${label} ${year}`
}

function buildYearOptions(maxYear: number) {
  const end = Math.max(2000, Math.min(2100, maxYear))
  return Array.from({ length: end - 1999 + 1 }, (_, i) => 2000 + i)
}

export function AssetDetailPage() {
  const { assetId } = useParams<{ assetId: string }>()
  const navigate = useNavigate()
  const { resolved } = useTheme()
  const [asset, setAsset] = useState<AssetSummary | null>(null)
  const [logs, setLogs] = useState<AssetLogRow[]>([])
  const [loadState, setLoadState] = useState<'loading' | 'ok' | 'error'>('loading')
  const [loadError, setLoadError] = useState<string | null>(null)

  const [isEditingAsset, setIsEditingAsset] = useState(false)
  const [editAssetName, setEditAssetName] = useState('')
  const [editAssetColor, setEditAssetColor] = useState(DEFAULT_ASSET_COLOR)
  const [editAssetError, setEditAssetError] = useState<string | null>(null)
  const [editAssetSaving, setEditAssetSaving] = useState(false)
  const [deleteAssetModalOpen, setDeleteAssetModalOpen] = useState(false)

  const [year, setYear] = useState(() => new Date().getFullYear())
  const [month, setMonth] = useState(() => new Date().getMonth() + 1)
  const [deposit, setDeposit] = useState('')
  const [balance, setBalance] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [editingLogId, setEditingLogId] = useState<string | null>(null)
  const [editYear, setEditYear] = useState(2000)
  const [editMonth, setEditMonth] = useState(1)
  const [editDeposit, setEditDeposit] = useState('')
  const [editBalance, setEditBalance] = useState('')
  const [editError, setEditError] = useState<string | null>(null)
  const [editSaving, setEditSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<AssetLogRow | null>(null)
  const [displayCurrency, setDisplayCurrency] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!assetId) return
    setLoadError(null)
    setLoadState('loading')
    try {
      const data = await apiJson<{ asset: AssetSummary; logs: AssetLogRow[] }>(`/api/assets/${assetId}/logs`)
      setAsset(data.asset)
      setLogs(data.logs)
      applyCurrentPeriodAndLatestDefaults(data.logs, setYear, setMonth, setDeposit, setBalance)
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
  }, [assetId, navigate])

  useEffect(() => {
    void load()
  }, [load])

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

  const logStats = useMemo(() => computeAssetLogStats(logs), [logs])
  const balanceChartPoints = useMemo(() => balanceOverTimePointsAsc(logs), [logs])
  const { moneyBars: monthlyMoneyBars, percentBars: monthlyPercentBars } = useMemo(
    () => monthlyPerformanceHistogramAsc(logs, defaultChartGainLossColors(resolved)),
    [logs, resolved],
  )

  const formatHistogramMoneyAxis = useCallback(
    (n: number) => formatSignedDisplayMoney(n, displayCurrency),
    [displayCurrency],
  )

  const formatHistogramPctAxis = useCallback((n: number) => {
    if (!Number.isFinite(n)) return '—'
    const sign = n > 0 ? '+' : ''
    return `${sign}${n.toFixed(2)}%`
  }, [])

  function startEditAsset() {
    if (!asset) return
    setIsEditingAsset(true)
    setEditAssetName(asset.name)
    setEditAssetColor(normalizePresetColor(asset.color))
    setEditAssetError(null)
  }

  function cancelEditAsset() {
    setIsEditingAsset(false)
    setEditAssetError(null)
  }

  async function onSaveAsset(e: FormEvent) {
    e.preventDefault()
    if (!assetId) return
    setEditAssetError(null)
    setEditAssetSaving(true)
    try {
      const res = await apiJson<{ asset: AssetRow }>(`/api/assets/${assetId}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: editAssetName.trim(), color: editAssetColor }),
      })
      setAsset({
        id: res.asset.id,
        name: res.asset.name,
        color: res.asset.color,
        createdAt: res.asset.createdAt,
      })
      cancelEditAsset()
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 401) {
        void navigate('/login', { replace: true })
        return
      }
      if (err instanceof ApiError) setEditAssetError(err.message)
      else setEditAssetError('Something went wrong')
    } finally {
      setEditAssetSaving(false)
    }
  }

  async function performDeleteAsset() {
    if (!assetId) return
    try {
      await apiJson<{ ok: boolean }>(`/api/assets/${assetId}`, { method: 'DELETE' })
      setDeleteAssetModalOpen(false)
      void navigate('/assets', { replace: true })
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 401) {
        setDeleteAssetModalOpen(false)
        void navigate('/login', { replace: true })
        return
      }
      if (err instanceof ApiError) throw err
      throw new Error('Could not delete asset')
    }
  }

  function startEditLog(row: AssetLogRow) {
    setEditingLogId(row.id)
    setEditYear(row.year)
    setEditMonth(row.month)
    setEditDeposit(formatNumericForInput(row.deposit))
    setEditBalance(formatNumericForInput(row.balance))
    setEditError(null)
  }

  function cancelEditLog() {
    setEditingLogId(null)
    setEditError(null)
  }

  async function onSaveLogEdit(e: FormEvent) {
    e.preventDefault()
    if (!assetId || !editingLogId) return
    setEditError(null)
    const depositNum = Number(editDeposit)
    const balanceNum = Number(editBalance)
    if (!Number.isFinite(depositNum)) {
      setEditError('Enter a valid deposit amount')
      return
    }
    if (!Number.isFinite(balanceNum)) {
      setEditError('Enter a valid balance')
      return
    }
    setEditSaving(true)
    try {
      await apiJson<{ log: AssetLogRow }>(`/api/assets/${assetId}/logs/${editingLogId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          year: editYear,
          month: editMonth,
          deposit: depositNum,
          balance: balanceNum,
        }),
      })
      cancelEditLog()
      await load()
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 401) {
        void navigate('/login', { replace: true })
        return
      }
      if (err instanceof ApiError) setEditError(err.message)
      else setEditError('Something went wrong')
    } finally {
      setEditSaving(false)
    }
  }

  async function performDeleteLog() {
    const target = deleteTarget
    if (!target || !assetId) return
    try {
      await apiJson<{ ok: boolean }>(`/api/assets/${assetId}/logs/${target.id}`, { method: 'DELETE' })
      setDeleteTarget(null)
      if (editingLogId === target.id) cancelEditLog()
      await load()
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 401) {
        setDeleteTarget(null)
        void navigate('/login', { replace: true })
        return
      }
      if (err instanceof ApiError) throw err
      throw new Error('Could not delete log')
    }
  }

  async function onSubmitNewLog(e: FormEvent) {
    e.preventDefault()
    if (!assetId) return
    setFormError(null)
    const depositNum = Number(deposit)
    const balanceNum = Number(balance)
    if (!Number.isFinite(depositNum)) {
      setFormError('Enter a valid deposit amount')
      return
    }
    if (!Number.isFinite(balanceNum)) {
      setFormError('Enter a valid balance')
      return
    }
    setSaving(true)
    try {
      await apiJson<{ log: AssetLogRow }>(`/api/assets/${assetId}/logs`, {
        method: 'POST',
        body: JSON.stringify({ year, month, deposit: depositNum, balance: balanceNum }),
      })
      await load()
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

  if (!assetId)
    return (
      <main className="app">
        <p className="error">Missing asset.</p>
        <Link to="/assets">← Assets</Link>
      </main>
    )

  if (loadState === 'loading') return <main className="app">Loading…</main>

  if (loadState === 'error')
    return (
      <main className="app">
        <p className="error">{loadError ?? 'Could not load asset.'}</p>
        <button type="button" className="btn" onClick={() => void load()}>
          Retry
        </button>
        <p className="page-back" style={{ marginTop: '1rem' }}>
          <Link to="/assets">← Assets</Link>
        </p>
      </main>
    )

  if (!asset)
    return (
      <main className="app">
        <p className="error">Asset not found.</p>
        <Link to="/assets">← Assets</Link>
      </main>
    )

  const yearNow = new Date().getFullYear()
  const endYear = Math.min(2100, yearNow + 1)
  const yearOptions = buildYearOptions(endYear)
  const editYearMax = Math.min(2100, Math.max(endYear, editYear))
  const editYearOptions = buildYearOptions(editYearMax)

  const deleteLogModalOpen = deleteTarget != null
  const logsBusy =
    deleteLogModalOpen || editSaving || saving || editAssetSaving || isEditingAsset || editingLogId != null
  const newLogLocked = editingLogId != null || editSaving || isEditingAsset || editAssetSaving
  const blockLogRowActions = deleteLogModalOpen || editSaving || saving || deleteAssetModalOpen || editAssetSaving

  return (
    <main className="app asset-detail-page">
      <p className="page-back">
        <Link to="/assets">← Assets</Link>
      </p>

      <header className="asset-detail-header">
        {isEditingAsset ? (
          <form className="asset-detail-edit card" onSubmit={(ev) => void onSaveAsset(ev)}>
            <div className="asset-detail-edit-title-row">
              <span className="asset-swatch asset-swatch--large" style={{ backgroundColor: editAssetColor }} />
              <h1 className="asset-detail-edit-heading">Edit asset</h1>
            </div>
            <label className="field">
              <span>Name</span>
              <input value={editAssetName} onChange={(ev) => setEditAssetName(ev.target.value)} required maxLength={120} />
            </label>
            <div className="field">
              <span>Color</span>
              <AssetColorPresets value={editAssetColor} onChange={setEditAssetColor} groupLabel={`Color for ${editAssetName || 'asset'}`} />
            </div>
            {editAssetError != null && <p className="error">{editAssetError}</p>}
            <div className="asset-detail-header-actions">
              <button type="button" className="btn" onClick={cancelEditAsset} disabled={editAssetSaving}>
                Cancel
              </button>
              <button type="submit" className="btn primary" disabled={editAssetSaving}>
                {editAssetSaving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        ) : (
          <>
            <div className="asset-detail-title-block">
              <span className="asset-swatch asset-swatch--large" style={{ backgroundColor: asset.color }} title={asset.name} />
              <div>
                <h1 className="asset-detail-name">{asset.name}</h1>
                <p className="asset-detail-date">Added {formatAssetDate(asset.createdAt)}</p>
              </div>
            </div>
            <div className="asset-detail-header-actions">
              <button type="button" className="btn" onClick={startEditAsset} disabled={logsBusy}>
                Edit asset
              </button>
              <button type="button" className="btn btn-danger" onClick={() => setDeleteAssetModalOpen(true)} disabled={logsBusy}>
                Delete asset
              </button>
            </div>
          </>
        )}
      </header>

      <section className="asset-detail-stats" aria-label="Portfolio summary">
        <div className="asset-detail-stat">
          <span className="asset-detail-stat-label">Current balance</span>
          <span className="asset-detail-stat-value">
            {formatDisplayMoney(logStats.currentBalance, displayCurrency)}
          </span>
        </div>
        <div className="asset-detail-stat">
          <span className="asset-detail-stat-label">Total deposits</span>
          <span className="asset-detail-stat-value">
            {logStats.hasLogs ? formatDisplayMoney(logStats.sumDeposits, displayCurrency) : '—'}
          </span>
        </div>
        <div className="asset-detail-stat">
          <span className="asset-detail-stat-label">P/L</span>
          <span className={`asset-detail-stat-value${gainMoneyStatToneClass(logStats)}`}>
            {logStats.hasLogs ? formatSignedDisplayMoney(logStats.gain, displayCurrency) : '—'}
          </span>
        </div>
        <div className="asset-detail-stat">
          <span className="asset-detail-stat-label">P/L %</span>
          <span className={`asset-detail-stat-value${percentPLStatToneClass(logStats)}`}>
            {formatPercentPLStat(logStats)}
          </span>
        </div>
      </section>

      {balanceChartPoints.length > 0 && (
        <section className="card asset-detail-chart-card" aria-label="Balance over time">
          <h2 className="card-title">Balance over time</h2>
          <p className="asset-detail-lead">End-of-month balance from your logs.</p>
          <BalanceOverTimeChart
            points={balanceChartPoints}
            lineColor={asset.color}
            displayCurrency={displayCurrency}
          />
        </section>
      )}

      {monthlyMoneyBars.length > 0 && (
        <div className="asset-detail-histogram-grid">
          <section className="card asset-detail-histogram-card" aria-label="Monthly P/L">
            <h2 className="card-title">Monthly P/L</h2>
            <p className="asset-detail-lead">
              Balance change vs the prior month, minus this month’s deposit (market effect). Green if up, red if down.
            </p>
            <HistogramBarChart
              points={monthlyMoneyBars}
              formatPrice={formatHistogramMoneyAxis}
              resolvedTheme={resolved}
            />
          </section>
          <section className="card asset-detail-histogram-card" aria-label="Monthly percent change">
            <h2 className="card-title">Monthly % change</h2>
            <p className="asset-detail-lead">
              Return vs starting capital (prior month balance + this deposit). Gray when a percentage is not defined.
            </p>
            <HistogramBarChart
              points={monthlyPercentBars}
              formatPrice={formatHistogramPctAxis}
              resolvedTheme={resolved}
            />
          </section>
        </div>
      )}

      <div className="asset-detail-stack">
        <section className="card asset-detail-logs-card">
          <h2 className="card-title">Logs</h2>
          <p className="asset-detail-lead">Monthly deposit and balance. One entry per month.</p>
          {logs.length === 0 ? (
            <p className="muted">No logs yet. Add one below.</p>
          ) : (
            <div className="table-wrap">
              <table className="logs-table">
                <thead>
                  <tr>
                    <th>Period</th>
                    <th className="logs-table__num">Deposit</th>
                    <th className="logs-table__num">Balance</th>
                    <th className="logs-table__actions">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((row) =>
                    editingLogId === row.id ? (
                      <tr key={row.id} className="logs-table__row--editing">
                        <td colSpan={4}>
                          <form className="log-row-edit" onSubmit={(ev) => void onSaveLogEdit(ev)}>
                            <div className="field-row field-row--period">
                              <label className="field">
                                <span>Year</span>
                                <select
                                  value={editYear}
                                  onChange={(ev) => setEditYear(Number(ev.target.value))}
                                  required
                                  disabled={editSaving}
                                >
                                  {editYearOptions.map((y) => (
                                    <option key={y} value={y}>
                                      {y}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <label className="field">
                                <span>Month</span>
                                <select
                                  value={editMonth}
                                  onChange={(ev) => setEditMonth(Number(ev.target.value))}
                                  required
                                  disabled={editSaving}
                                >
                                  {MONTH_OPTIONS.map((m) => (
                                    <option key={m.value} value={m.value}>
                                      {m.label}
                                    </option>
                                  ))}
                                </select>
                              </label>
                            </div>
                            <label className="field">
                              <span>Deposit</span>
                              <input
                                value={editDeposit}
                                onChange={(ev) => setEditDeposit(ev.target.value)}
                                inputMode="decimal"
                                disabled={editSaving}
                              />
                            </label>
                            <label className="field">
                              <span>Balance</span>
                              <input
                                value={editBalance}
                                onChange={(ev) => setEditBalance(ev.target.value)}
                                inputMode="decimal"
                                disabled={editSaving}
                              />
                            </label>
                            {editError != null && <p className="error">{editError}</p>}
                            <div className="log-row-edit-actions">
                              <button type="button" className="btn" onClick={cancelEditLog} disabled={editSaving}>
                                Cancel
                              </button>
                              <button type="submit" className="btn primary" disabled={editSaving}>
                                {editSaving ? 'Saving…' : 'Save'}
                              </button>
                            </div>
                          </form>
                        </td>
                      </tr>
                    ) : (
                      <tr key={row.id}>
                        <td>{formatLogPeriod(row.year, row.month)}</td>
                        <td className="logs-table__num">
                          {formatDisplayMoneyFromString(row.deposit, displayCurrency)}
                        </td>
                        <td className="logs-table__num">
                          {formatDisplayMoneyFromString(row.balance, displayCurrency)}
                        </td>
                        <td className="logs-table__actions">
                          <div className="logs-table__actions-inner">
                            <button
                              type="button"
                              className="btn"
                              onClick={() => startEditLog(row)}
                              disabled={blockLogRowActions || (editingLogId != null && editingLogId !== row.id) || isEditingAsset}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="btn btn-danger"
                              onClick={() => setDeleteTarget(row)}
                              disabled={blockLogRowActions || editingLogId != null || isEditingAsset}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="card asset-detail-new-log-card">
          <h2 className="card-title">New log</h2>
          <form className="form" onSubmit={(ev) => void onSubmitNewLog(ev)}>
            <div className="field-row field-row--period">
              <label className="field">
                <span>Year</span>
                <select value={year} onChange={(ev) => setYear(Number(ev.target.value))} required disabled={newLogLocked}>
                  {yearOptions.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Month</span>
                <select value={month} onChange={(ev) => setMonth(Number(ev.target.value))} required disabled={newLogLocked}>
                  {MONTH_OPTIONS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="field">
              <span>Deposit</span>
              <input
                value={deposit}
                onChange={(ev) => setDeposit(ev.target.value)}
                inputMode="decimal"
                placeholder="0"
                autoComplete="off"
                disabled={newLogLocked}
              />
            </label>
            <label className="field">
              <span>Balance</span>
              <input
                value={balance}
                onChange={(ev) => setBalance(ev.target.value)}
                inputMode="decimal"
                placeholder="0"
                autoComplete="off"
                disabled={newLogLocked}
              />
            </label>
            {newLogLocked && <p className="hint">Finish or cancel the row or asset edit before adding a log.</p>}
            {formError != null && <p className="error">{formError}</p>}
            <button type="submit" className="btn primary" disabled={saving || newLogLocked}>
              {saving ? 'Saving…' : 'Save log'}
            </button>
          </form>
        </section>
      </div>

      <ConfirmModal
        open={deleteLogModalOpen}
        title="Delete log?"
        description={
          deleteTarget != null
            ? `Remove the entry for ${formatLogPeriod(deleteTarget.year, deleteTarget.month)}? This cannot be undone.`
            : ''
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        danger
        onClose={() => setDeleteTarget(null)}
        onConfirm={performDeleteLog}
      />

      <ConfirmModal
        open={deleteAssetModalOpen}
        title="Delete asset?"
        description={`Permanently remove “${asset.name}” and all its logs? This cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        danger
        onClose={() => setDeleteAssetModalOpen(false)}
        onConfirm={performDeleteAsset}
      />
    </main>
  )
}
