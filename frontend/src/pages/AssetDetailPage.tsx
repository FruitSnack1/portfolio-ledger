import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import { AssetAddLogModal } from '../components/AssetAddLogModal'
import { AssetEditLogModal } from '../components/AssetEditLogModal'
import { AssetColorPresets } from '../components/AssetColorPresets'
import { ConfirmModal } from '../components/ConfirmModal'
import { Toast } from '../components/Toast'
import { formatDbNumericForInput } from '../asset/formatDbNumericForInput'
import { balanceOverTimePointsAsc } from '../asset/logBalanceTimeSeries'
import { defaultChartGainLossColors, monthlyPerformanceHistogramAsc } from '../asset/logMonthlyPerformanceSeries'
import { useTheme } from '../theme/ThemeProvider'
import type { AssetRow } from './AssetsPage'

type AssetSummary = { id: string; name: string; color: string; createdAt: string; withdrawn: boolean }

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

function normalizePresetColor(hex: string) {
  const u = hex.toUpperCase()
  if (ASSET_COLOR_PRESETS.some((p) => p.hex === u)) return u
  return DEFAULT_ASSET_COLOR
}

function depositBalanceFromLatestLog(logs: AssetLogRow[]) {
  if (logs.length === 0) return { deposit: '', balance: '' }
  const latest = logs[0]
  return {
    deposit: formatDbNumericForInput(latest.deposit),
    balance: formatDbNumericForInput(latest.balance),
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
  const [assetMenuOpen, setAssetMenuOpen] = useState(false)
  const [withdrawnSaving, setWithdrawnSaving] = useState(false)
  const [assetPatchError, setAssetPatchError] = useState<string | null>(null)
  const menuWrapRef = useRef<HTMLDivElement>(null)

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
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [addLogModalOpen, setAddLogModalOpen] = useState(false)

  const clearToast = useCallback(() => setToastMessage(null), [])

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!assetId) return
    setLoadError(null)
    if (!opts?.silent) setLoadState('loading')
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
    if (isEditingAsset) setAssetMenuOpen(false)
  }, [isEditingAsset])

  useEffect(() => {
    if (!assetMenuOpen) return
    function onPointerDown(e: PointerEvent) {
      const root = menuWrapRef.current
      if (!root || !(e.target instanceof Node) || root.contains(e.target)) return
      setAssetMenuOpen(false)
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setAssetMenuOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [assetMenuOpen])

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
    setAssetMenuOpen(false)
    setAssetPatchError(null)
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
        withdrawn: res.asset.withdrawn,
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

  async function patchWithdrawn(next: boolean) {
    if (!assetId) return
    setAssetPatchError(null)
    setWithdrawnSaving(true)
    try {
      const res = await apiJson<{ asset: AssetRow }>(`/api/assets/${assetId}`, {
        method: 'PATCH',
        body: JSON.stringify({ withdrawn: next }),
      })
      setAsset({
        id: res.asset.id,
        name: res.asset.name,
        color: res.asset.color,
        createdAt: res.asset.createdAt,
        withdrawn: res.asset.withdrawn,
      })
      setAssetMenuOpen(false)
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 401) {
        void navigate('/login', { replace: true })
        return
      }
      if (err instanceof ApiError) setAssetPatchError(err.message)
      else setAssetPatchError('Something went wrong')
    } finally {
      setWithdrawnSaving(false)
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
    setEditDeposit(formatDbNumericForInput(row.deposit))
    setEditBalance(formatDbNumericForInput(row.balance))
    setEditError(null)
  }

  function cancelEditLog() {
    setEditingLogId(null)
    setEditError(null)
  }

  function openAddLogModal() {
    setAssetMenuOpen(false)
    setFormError(null)
    applyCurrentPeriodAndLatestDefaults(logs, setYear, setMonth, setDeposit, setBalance)
    setAddLogModalOpen(true)
  }

  function closeAddLogModal() {
    setAddLogModalOpen(false)
    setFormError(null)
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
      setToastMessage(`Log saved for ${formatLogPeriod(editYear, editMonth)}`)
      await load({ silent: true })
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
      setToastMessage('Log deleted')
      await load({ silent: true })
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
      setAddLogModalOpen(false)
      setToastMessage(`Log added for ${formatLogPeriod(year, month)}`)
      await load({ silent: true })
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
    deleteLogModalOpen ||
    editSaving ||
    saving ||
    editAssetSaving ||
    isEditingAsset ||
    editingLogId != null ||
    withdrawnSaving ||
    addLogModalOpen
  const newLogLocked = editingLogId != null || editSaving || isEditingAsset || editAssetSaving
  const blockLogRowActions =
    deleteLogModalOpen ||
    editSaving ||
    saving ||
    deleteAssetModalOpen ||
    editAssetSaving ||
    withdrawnSaving ||
    addLogModalOpen ||
    editingLogId != null

  return (
    <main className="app asset-detail-page">
      <Toast message={toastMessage} onRequestClear={clearToast} />

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
          <div className="asset-detail-header-row">
            <div className="asset-detail-title-block">
              <span className="asset-swatch asset-swatch--large" style={{ backgroundColor: asset.color }} title={asset.name} />
              <div>
                <h1 className="asset-detail-name">{asset.name}</h1>
                {asset.withdrawn ? (
                  <p className="asset-detail-subline">
                    <span className="asset-withdrawn-pill">Withdrawn</span>
                    <span className="muted"> Excluded from your home dashboard.</span>
                  </p>
                ) : null}
              </div>
            </div>
            <div className="asset-detail-header-actions">
              <button
                type="button"
                className="btn primary asset-detail-add-log-btn"
                disabled={newLogLocked || saving || addLogModalOpen}
                onClick={() => openAddLogModal()}
              >
                Add log
              </button>
              <div className="asset-detail-menu-wrap" ref={menuWrapRef}>
                <button
                  type="button"
                  className="asset-detail-menu-trigger"
                  aria-label="Asset actions"
                  aria-haspopup="menu"
                  aria-expanded={assetMenuOpen}
                  disabled={logsBusy}
                  onClick={() => {
                    setAssetPatchError(null)
                    setAssetMenuOpen((open) => !open)
                  }}
                >
                  <span className="asset-detail-menu-dots" aria-hidden>
                    &#8942;
                  </span>
                </button>
                {assetMenuOpen ? (
                  <ul className="asset-detail-menu" role="menu">
                  <li role="none">
                    <button
                      type="button"
                      role="menuitem"
                      className="asset-detail-menu-item"
                      disabled={logsBusy}
                      onClick={() => startEditAsset()}
                    >
                      Edit
                    </button>
                  </li>
                  <li role="none">
                    <button
                      type="button"
                      role="menuitem"
                      className="asset-detail-menu-item"
                      disabled={logsBusy || withdrawnSaving}
                      onClick={() => void patchWithdrawn(!asset.withdrawn)}
                    >
                      {withdrawnSaving ? 'Updating…' : asset.withdrawn ? 'Unmark as withdrawn' : 'Mark as withdrawn'}
                    </button>
                  </li>
                  <li role="none">
                    <button
                      type="button"
                      role="menuitem"
                      className="asset-detail-menu-item asset-detail-menu-item--danger"
                      disabled={logsBusy}
                      onClick={() => {
                        setAssetMenuOpen(false)
                        setDeleteAssetModalOpen(true)
                      }}
                    >
                      Delete
                    </button>
                  </li>
                </ul>
                ) : null}
              </div>
            </div>
          </div>
        )}
      </header>

      {assetPatchError != null ? <p className="error asset-detail-patch-error">{assetPatchError}</p> : null}

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
            <p className="muted">No logs yet. Use Add log above.</p>
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
                  {logs.map((row) => (
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
                            disabled={blockLogRowActions || isEditingAsset}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="btn btn-danger"
                            onClick={() => setDeleteTarget(row)}
                            disabled={blockLogRowActions || isEditingAsset}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <AssetEditLogModal
        open={editingLogId != null}
        onClose={cancelEditLog}
        year={editYear}
        month={editMonth}
        deposit={editDeposit}
        balance={editBalance}
        onYearChange={setEditYear}
        onMonthChange={setEditMonth}
        onDepositChange={setEditDeposit}
        onBalanceChange={setEditBalance}
        yearOptions={editYearOptions}
        monthOptions={MONTH_OPTIONS}
        formError={editError}
        fieldsDisabled={isEditingAsset || editAssetSaving || addLogModalOpen}
        saving={editSaving}
        onSubmit={onSaveLogEdit}
      />

      <AssetAddLogModal
        open={addLogModalOpen}
        onClose={closeAddLogModal}
        year={year}
        month={month}
        deposit={deposit}
        balance={balance}
        onYearChange={setYear}
        onMonthChange={setMonth}
        onDepositChange={setDeposit}
        onBalanceChange={setBalance}
        yearOptions={yearOptions}
        monthOptions={MONTH_OPTIONS}
        formError={formError}
        fieldsDisabled={newLogLocked}
        saving={saving}
        onSubmit={onSubmitNewLog}
      />

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
