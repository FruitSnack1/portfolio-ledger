import { type FormEvent, useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ApiError, apiJson } from '../api/client'
import { ConfirmModal } from '../components/ConfirmModal'

type AssetSummary = { id: string; name: string; color: string }

export type AssetLogRow = {
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

function formatNumericForInput(raw: string) {
  const n = Number(raw)
  if (!Number.isFinite(n)) return raw
  return String(n)
}

/** API returns logs ordered by (year, month) descending; first row is latest. */
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

export function AssetLogsPage() {
  const { assetId } = useParams<{ assetId: string }>()
  const navigate = useNavigate()
  const [asset, setAsset] = useState<AssetSummary | null>(null)
  const [logs, setLogs] = useState<AssetLogRow[]>([])
  const [loadState, setLoadState] = useState<'loading' | 'ok' | 'error'>('loading')
  const [loadError, setLoadError] = useState<string | null>(null)

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

  const load = useCallback(async () => {
    if (!assetId) return
    setLoadError(null)
    setLoadState('loading')
    try {
      const data = await apiJson<{ asset: AssetSummary; logs: AssetLogRow[] }>(`/api/assets/${assetId}/logs`)
      setAsset(data.asset)
      setLogs(data.logs)
      applyCurrentPeriodAndLatestDefaults(
        data.logs,
        setYear,
        setMonth,
        setDeposit,
        setBalance,
      )
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

  function startEdit(row: AssetLogRow) {
    setEditingLogId(row.id)
    setEditYear(row.year)
    setEditMonth(row.month)
    setEditDeposit(formatNumericForInput(row.deposit))
    setEditBalance(formatNumericForInput(row.balance))
    setEditError(null)
  }

  function cancelEdit() {
    setEditingLogId(null)
    setEditError(null)
  }

  async function onSaveEdit(e: FormEvent) {
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
      cancelEdit()
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

  async function performDelete() {
    const target = deleteTarget
    if (!target || !assetId) return
    try {
      await apiJson<{ ok: boolean }>(`/api/assets/${assetId}/logs/${target.id}`, { method: 'DELETE' })
      setDeleteTarget(null)
      if (editingLogId === target.id) cancelEdit()
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

  async function onSubmit(e: FormEvent) {
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

  if (loadState === 'loading') return <main className="app">Loading logs…</main>

  if (loadState === 'error')
    return (
      <main className="app">
        <p className="error">{loadError ?? 'Could not load logs.'}</p>
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

  const deleteModalOpen = deleteTarget != null
  const blockRowActions = deleteModalOpen || editSaving || saving
  const newLogLocked = editingLogId != null || editSaving

  return (
    <main className="app asset-logs-page">
      <p className="page-back">
        <Link to="/assets">← Assets</Link>
      </p>
      <h1>
        <span className="asset-logs-title-swatch" style={{ backgroundColor: asset.color }} title={asset.name} />
        Logs — {asset.name}
      </h1>
      <p className="muted">Add a monthly deposit and balance. One entry per month per asset. You can edit or remove past entries from the list.</p>

      <div className="asset-logs-layout">
        <section className="card asset-log-form-card">
          <h2 className="card-title">New log</h2>
          <form className="form" onSubmit={(ev) => void onSubmit(ev)}>
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
            {newLogLocked && <p className="hint">Finish or cancel the row edit before adding a new log.</p>}
            {formError != null && <p className="error">{formError}</p>}
            <button type="submit" className="btn primary" disabled={saving || newLogLocked}>
              {saving ? 'Saving…' : 'Save log'}
            </button>
          </form>
        </section>

        <section className="card asset-log-list-card">
          <h2 className="card-title">Existing logs</h2>
          {logs.length === 0 ? (
            <p className="muted">No logs yet. Add the first one with the form.</p>
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
                          <form className="log-row-edit" onSubmit={(ev) => void onSaveEdit(ev)}>
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
                              <button type="button" className="btn" onClick={cancelEdit} disabled={editSaving}>
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
                        <td className="logs-table__num">{formatNumericForInput(row.deposit)}</td>
                        <td className="logs-table__num">{formatNumericForInput(row.balance)}</td>
                        <td className="logs-table__actions">
                          <div className="logs-table__actions-inner">
                            <button
                              type="button"
                              className="btn"
                              onClick={() => startEdit(row)}
                              disabled={blockRowActions || (editingLogId != null && editingLogId !== row.id)}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="btn btn-danger"
                              onClick={() => setDeleteTarget(row)}
                              disabled={blockRowActions || editingLogId != null}
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
      </div>

      <ConfirmModal
        open={deleteModalOpen}
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
        onConfirm={performDelete}
      />
    </main>
  )
}
