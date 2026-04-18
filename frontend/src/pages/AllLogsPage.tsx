import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ApiError, apiJson } from '../api/client'
import { formatDbNumericForInput } from '../asset/formatDbNumericForInput'
import { AllLogEditModal } from '../components/AllLogEditModal'
import { BulkImportModal, type BulkDraftResponse } from '../components/BulkImportModal'
import { ConfirmModal } from '../components/ConfirmModal'
import { CsvImportModal, type CsvImportResponse } from '../components/CsvImportModal'
import { buildLogsCsvForExport, downloadCsvFile } from '../csv/logsCsv'
import type { UserWithCurrency } from '../components/CurrencySettingsModal'
import { Toast } from '../components/Toast'
import { formatDisplayMoneyFromString } from '../currency/formatDisplayMoney'

type MeResponse = { user: UserWithCurrency }

export type AllLogRow = {
  id: string
  assetId: string
  assetName: string
  assetColor: string
  withdrawn: boolean
  year: number
  month: number
  deposit: string
  balance: string
  createdAt: string
}

const MONTH_LABELS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const

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

function formatLogPeriodShort(year: number, month: number) {
  const label = MONTH_LABELS[month - 1] ?? String(month)
  return `${label} ${year}`
}

function formatLogPeriodLong(year: number, month: number) {
  const label = MONTH_OPTIONS.find((m) => m.value === month)?.label ?? String(month)
  return `${label} ${year}`
}

type AssetFilterOption = { id: string; name: string; color: string; withdrawn: boolean }

type BulkSubmitResponse = {
  year: number
  month: number
  created: { assetId: string; name: string; log: { id: string; year: number; month: number; deposit: string; balance: string; createdAt: string } }[]
  failed: { assetId: string; name: string; error: string }[]
}

function bulkImportSuccessToast(res: BulkSubmitResponse): string {
  const n = res.created.length
  const base = n === 1 ? 'Bulk imported 1 log.' : `Bulk imported ${n} logs.`
  if (res.failed.length === 0) return base
  const f = res.failed.length
  const tail = f === 1 ? ' 1 could not be saved.' : ` ${f} could not be saved.`
  return base + tail
}

function formatCsvImportToast(res: CsvImportResponse): string {
  const parts: string[] = []
  if (res.createdLogs > 0) parts.push(res.createdLogs === 1 ? '1 log created' : `${res.createdLogs} logs created`)
  if (res.updatedLogs > 0) parts.push(res.updatedLogs === 1 ? '1 log updated' : `${res.updatedLogs} logs updated`)
  if (parts.length === 0) parts.push('No rows saved')
  if (res.assetsCreated.length > 0)
    parts.push(`new assets: ${res.assetsCreated.map((a) => a.name).join(', ')}`)
  if (res.failed.length > 0) {
    const sample = res.failed
      .slice(0, 3)
      .map((f) => `L${f.line}: ${f.detail}`)
      .join('; ')
    parts.push(`${res.failed.length} failed (${sample}${res.failed.length > 3 ? '…' : ''})`)
  }
  return parts.join(' · ')
}

export function AllLogsPage() {
  const navigate = useNavigate()
  const [displayCurrency, setDisplayCurrency] = useState<string | null>(null)
  const [logs, setLogs] = useState<AllLogRow[]>([])
  const [loadState, setLoadState] = useState<'loading' | 'ok' | 'error'>('loading')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [filterAssetIds, setFilterAssetIds] = useState<Set<string>>(() => new Set())

  const [bulkModalOpen, setBulkModalOpen] = useState(false)
  const [bulkDraftLoading, setBulkDraftLoading] = useState(false)
  const [bulkDraftLoadError, setBulkDraftLoadError] = useState<string | null>(null)
  const [bulkDraft, setBulkDraft] = useState<BulkDraftResponse | null>(null)
  const [bulkValues, setBulkValues] = useState<Record<string, { deposit: string; balance: string }>>({})
  const [bulkUiError, setBulkUiError] = useState<string | null>(null)
  const [bulkSubmitting, setBulkSubmitting] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const [editModalLog, setEditModalLog] = useState<AllLogRow | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<AllLogRow | null>(null)
  const [csvMenuOpen, setCsvMenuOpen] = useState(false)
  const [csvImportOpen, setCsvImportOpen] = useState(false)
  const csvMenuRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    setLoadError(null)
    setLoadState('loading')
    try {
      const meData = await apiJson<MeResponse>('/api/auth/me')
      setDisplayCurrency(meData.user.displayCurrency ?? null)
      const data = await apiJson<{ logs: AllLogRow[] }>('/api/logs')
      setLogs(data.logs)
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

  const refreshLogs = useCallback(async () => {
    try {
      const data = await apiJson<{ logs: AllLogRow[] }>('/api/logs')
      setLogs(data.logs)
    } catch (e: unknown) {
      if (e instanceof ApiError && e.status === 401) {
        void navigate('/login', { replace: true })
        return
      }
    }
  }, [navigate])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!csvMenuOpen) return
    function onPointerDown(e: PointerEvent) {
      const root = csvMenuRef.current
      if (!root || !(e.target instanceof Node) || root.contains(e.target)) return
      setCsvMenuOpen(false)
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setCsvMenuOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [csvMenuOpen])

  const clearToast = useCallback(() => setToastMessage(null), [])

  function exportLogsCsv() {
    const stamp = new Date().toISOString().slice(0, 10)
    downloadCsvFile(`portfolio-logs-${stamp}.csv`, buildLogsCsvForExport(logs))
    setCsvMenuOpen(false)
  }

  function openCsvImport() {
    setCsvMenuOpen(false)
    setCsvImportOpen(true)
  }

  function closeBulkModal() {
    setBulkModalOpen(false)
    setBulkDraft(null)
    setBulkValues({})
    setBulkUiError(null)
    setBulkDraftLoading(false)
    setBulkDraftLoadError(null)
  }

  async function openBulkModal() {
    setBulkModalOpen(true)
    setBulkDraft(null)
    setBulkValues({})
    setBulkUiError(null)
    setBulkDraftLoadError(null)
    setBulkDraftLoading(true)
    try {
      const data = await apiJson<BulkDraftResponse>('/api/assets/bulk-import/current-month-draft')
      setBulkDraft(data)
      const init: Record<string, { deposit: string; balance: string }> = {}
      for (const r of data.rows)
        init[r.assetId] = {
          deposit: formatDbNumericForInput(r.prefillDeposit),
          balance: formatDbNumericForInput(r.prefillBalance),
        }
      setBulkValues(init)
    } catch (e: unknown) {
      if (e instanceof ApiError && e.status === 401) {
        closeBulkModal()
        void navigate('/login', { replace: true })
        return
      }
      if (e instanceof ApiError) setBulkDraftLoadError(e.message)
      else setBulkDraftLoadError('Could not load draft')
    } finally {
      setBulkDraftLoading(false)
    }
  }

  async function submitBulkCurrentMonth() {
    if (!bulkDraft) return
    setBulkUiError(null)
    const entries = bulkDraft.rows
      .filter((r) => !r.blocked)
      .map((r) => {
        const v = bulkValues[r.assetId]
        if (!v) return null
        return { assetId: r.assetId, deposit: Number(v.deposit), balance: Number(v.balance) }
      })
      .filter((e): e is { assetId: string; deposit: number; balance: number } => e != null)

    if (entries.length === 0) {
      setBulkUiError('Nothing to save — no editable rows (all assets already have this month, or no active assets).')
      return
    }

    for (const e of entries) {
      if (!Number.isFinite(e.deposit) || !Number.isFinite(e.balance)) {
        setBulkUiError('Enter valid numbers for deposit and balance on every editable row.')
        return
      }
    }

    setBulkSubmitting(true)
    try {
      const res = await apiJson<BulkSubmitResponse>('/api/assets/bulk-import/current-month', {
        method: 'POST',
        body: JSON.stringify({ entries }),
      })
      setToastMessage(bulkImportSuccessToast(res))
      closeBulkModal()
      await refreshLogs()
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 401) {
        closeBulkModal()
        void navigate('/login', { replace: true })
        return
      }
      if (err instanceof ApiError) setBulkUiError(err.message)
      else setBulkUiError('Something went wrong')
    } finally {
      setBulkSubmitting(false)
    }
  }

  const assetFilterOptions = useMemo(() => {
    const map = new Map<string, AssetFilterOption>()
    for (const row of logs) {
      if (map.has(row.assetId)) continue
      map.set(row.assetId, {
        id: row.assetId,
        name: row.assetName,
        color: row.assetColor,
        withdrawn: row.withdrawn,
      })
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name))
  }, [logs])

  const filteredLogs = useMemo(() => {
    if (filterAssetIds.size === 0) return logs
    return logs.filter((row) => filterAssetIds.has(row.assetId))
  }, [logs, filterAssetIds])

  const allFiltersActive = filterAssetIds.size === 0

  function clearAssetFilters() {
    setFilterAssetIds(new Set())
  }

  function toggleAssetFilter(assetId: string) {
    setFilterAssetIds((prev) => {
      const next = new Set(prev)
      if (next.has(assetId)) next.delete(assetId)
      else next.add(assetId)
      return next
    })
  }

  async function performDeleteLog() {
    const target = deleteTarget
    if (!target) return
    try {
      await apiJson<{ ok: boolean }>(`/api/assets/${target.assetId}/logs/${target.id}`, { method: 'DELETE' })
      setDeleteTarget(null)
      if (editModalLog?.id === target.id) setEditModalLog(null)
      await refreshLogs()
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

  const deleteLogModalOpen = deleteTarget != null
  const blockLogRowActions = deleteLogModalOpen || bulkSubmitting || editModalLog != null || csvImportOpen

  if (loadState === 'loading') return <main className="app">Loading logs…</main>

  if (loadState === 'error')
    return (
      <main className="app">
        <p className="error">{loadError ?? 'Could not load logs.'}</p>
        <button type="button" className="btn" onClick={() => void load()}>
          Retry
        </button>
      </main>
    )

  return (
    <main className="app all-logs-page">
      <p className="page-back">
        <Link to="/">← Home</Link>
        {' · '}
        <Link to="/assets">Assets</Link>
      </p>

      <div className="assets-page-heading">
        <div>
          <h1 className="all-logs-page-title">All logs</h1>
          <p className="muted all-logs-page-lead">
            Monthly entries across every asset, newest period first. Use badges to narrow by asset.
          </p>
        </div>
        <div className="all-logs-heading-actions">
          <button type="button" className="btn assets-bulk-trigger" onClick={() => void openBulkModal()}>
            Bulk import current month
          </button>
          <div className="asset-detail-menu-wrap all-logs-csv-menu-wrap" ref={csvMenuRef}>
            <button
              type="button"
              className="asset-detail-menu-trigger"
              aria-label="CSV import and export"
              aria-haspopup="menu"
              aria-expanded={csvMenuOpen}
              disabled={bulkSubmitting || csvImportOpen}
              onClick={() => setCsvMenuOpen((o) => !o)}
            >
              <span className="asset-detail-menu-dots" aria-hidden>
                &#8942;
              </span>
            </button>
            {csvMenuOpen ? (
              <ul className="asset-detail-menu all-logs-csv-menu" role="menu">
                <li role="none">
                  <button type="button" role="menuitem" className="asset-detail-menu-item" onClick={exportLogsCsv}>
                    Export CSV
                  </button>
                </li>
                <li role="none">
                  <button type="button" role="menuitem" className="asset-detail-menu-item" onClick={openCsvImport}>
                    Import CSV…
                  </button>
                </li>
              </ul>
            ) : null}
          </div>
        </div>
      </div>

      <Toast message={toastMessage} onRequestClear={clearToast} />

      <BulkImportModal
        open={bulkModalOpen}
        onClose={closeBulkModal}
        draftLoading={bulkDraftLoading}
        draftLoadError={bulkDraftLoadError}
        draft={bulkDraft}
        bulkValues={bulkValues}
        setBulkValues={setBulkValues}
        bulkUiError={bulkUiError}
        bulkSubmitting={bulkSubmitting}
        onSubmit={submitBulkCurrentMonth}
      />

      {logs.length === 0 ? (
        <p className="muted">No logs yet. Add entries on each asset page, or use bulk import if you have assets.</p>
      ) : (
        <>
          <div className="all-logs-filters" role="group" aria-label="Filter by asset">
            <button
              type="button"
              className={`all-logs-filter-badge all-logs-filter-badge--all${allFiltersActive ? ' all-logs-filter-badge--active' : ''}`}
              onClick={clearAssetFilters}
              aria-pressed={allFiltersActive}
            >
              All
            </button>
            {assetFilterOptions.map((a) => {
              const pressed = !allFiltersActive && filterAssetIds.has(a.id)
              return (
                <button
                  key={a.id}
                  type="button"
                  className={`all-logs-filter-badge all-logs-filter-badge--asset${pressed ? ' all-logs-filter-badge--active' : ''}${a.withdrawn ? ' all-logs-filter-badge--withdrawn' : ''}`}
                  style={{ ['--log-filter-accent' as string]: a.color }}
                  onClick={() => toggleAssetFilter(a.id)}
                  aria-pressed={pressed}
                >
                  <span className="all-logs-filter-badge-swatch" style={{ backgroundColor: a.color }} aria-hidden />
                  {a.name}
                </button>
              )
            })}
          </div>

          <section className="card all-logs-table-card">
            <h2 className="card-title">Entries</h2>
            {filteredLogs.length === 0 ? (
              <p className="muted">No entries match the current filters.</p>
            ) : (
              <div className="table-wrap">
                <table className="logs-table all-logs-table">
                  <thead>
                    <tr>
                      <th>Asset</th>
                      <th>Period</th>
                      <th className="logs-table__num">Deposit</th>
                      <th className="logs-table__num">Balance</th>
                      <th className="logs-table__actions">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLogs.map((row) => (
                      <tr key={row.id} className={row.withdrawn ? 'all-logs-table__row--withdrawn' : undefined}>
                        <td>
                          <Link
                            to={`/assets/${row.assetId}`}
                            className={`all-logs-asset-link${row.withdrawn ? ' all-logs-asset-link--withdrawn' : ''}`}
                          >
                            <span className="all-logs-asset-swatch" style={{ backgroundColor: row.assetColor }} aria-hidden />
                            {row.assetName}
                          </Link>
                        </td>
                        <td>{formatLogPeriodShort(row.year, row.month)}</td>
                        <td className="logs-table__num">{formatDisplayMoneyFromString(row.deposit, displayCurrency)}</td>
                        <td className="logs-table__num">{formatDisplayMoneyFromString(row.balance, displayCurrency)}</td>
                        <td className="logs-table__actions">
                          <div className="logs-table__actions-inner">
                            <button
                              type="button"
                              className="btn"
                              onClick={() => setEditModalLog(row)}
                              disabled={blockLogRowActions}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="btn btn-danger"
                              onClick={() => setDeleteTarget(row)}
                              disabled={blockLogRowActions}
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
        </>
      )}

      <CsvImportModal
        open={csvImportOpen}
        onClose={() => setCsvImportOpen(false)}
        onComplete={(res) => {
          setToastMessage(formatCsvImportToast(res))
          setCsvImportOpen(false)
          void refreshLogs()
        }}
        navigate={navigate}
      />

      <AllLogEditModal log={editModalLog} onClose={() => setEditModalLog(null)} onSaved={refreshLogs} navigate={navigate} />

      <ConfirmModal
        open={deleteLogModalOpen}
        title="Delete log?"
        description={
          deleteTarget != null
            ? `Remove the entry for ${formatLogPeriodLong(deleteTarget.year, deleteTarget.month)} on “${deleteTarget.assetName}”? This cannot be undone.`
            : ''
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        danger
        onClose={() => setDeleteTarget(null)}
        onConfirm={performDeleteLog}
      />
    </main>
  )
}
