import { type FormEvent, useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ASSET_COLOR_PRESETS, DEFAULT_ASSET_COLOR } from '../asset/assetColorPalette'
import { ApiError, apiJson } from '../api/client'
import { AssetColorPresets } from '../components/AssetColorPresets'
import { formatDbNumericForInput } from '../asset/formatDbNumericForInput'
import { BulkImportModal, type BulkDraftResponse } from '../components/BulkImportModal'
import { Toast } from '../components/Toast'

export type AssetRow = { id: string; name: string; color: string; createdAt: string; withdrawn: boolean }

function formatAssetDate(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString(undefined, { dateStyle: 'medium' })
}

function assetColorLabel(hex: string) {
  const preset = ASSET_COLOR_PRESETS.find((p) => p.hex === hex.toUpperCase())
  if (preset) return `${preset.label} (${preset.hex})`
  return hex
}

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

export function AssetsPage() {
  const navigate = useNavigate()
  const [assets, setAssets] = useState<AssetRow[]>([])
  const [loadState, setLoadState] = useState<'loading' | 'ok' | 'error'>('loading')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [color, setColor] = useState(DEFAULT_ASSET_COLOR)
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [bulkModalOpen, setBulkModalOpen] = useState(false)
  const [bulkDraftLoading, setBulkDraftLoading] = useState(false)
  const [bulkDraftLoadError, setBulkDraftLoadError] = useState<string | null>(null)
  const [bulkDraft, setBulkDraft] = useState<BulkDraftResponse | null>(null)
  const [bulkValues, setBulkValues] = useState<Record<string, { deposit: string; balance: string }>>({})
  const [bulkUiError, setBulkUiError] = useState<string | null>(null)
  const [bulkSubmitting, setBulkSubmitting] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

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

  const clearToast = useCallback(() => setToastMessage(null), [])

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
        <button type="button" className="btn assets-bulk-trigger" onClick={() => void openBulkModal()}>
          Bulk import current month
        </button>
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
                      <span className="asset-name">{a.name}</span>
                      {a.withdrawn ? (
                        <span className="asset-withdrawn-pill">Withdrawn</span>
                      ) : (
                        <span className="muted asset-date">{formatAssetDate(a.createdAt)}</span>
                      )}
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
