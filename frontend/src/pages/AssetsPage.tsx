import { type FormEvent, useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ASSET_COLOR_PRESETS, DEFAULT_ASSET_COLOR } from '../asset/assetColorPalette'
import { ApiError, apiJson } from '../api/client'
import { AssetColorPresets } from '../components/AssetColorPresets'
import { ConfirmModal } from '../components/ConfirmModal'

export type AssetRow = { id: string; name: string; color: string; createdAt: string }

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

function normalizePresetColor(hex: string) {
  const u = hex.toUpperCase()
  if (ASSET_COLOR_PRESETS.some((p) => p.hex === u)) return u
  return DEFAULT_ASSET_COLOR
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

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editColor, setEditColor] = useState(DEFAULT_ASSET_COLOR)
  const [editError, setEditError] = useState<string | null>(null)
  const [editSaving, setEditSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<AssetRow | null>(null)

  const load = useCallback(async () => {
    setLoadError(null)
    setLoadState('loading')
    try {
      const data = await apiJson<{ assets: AssetRow[] }>('/api/assets')
      setAssets(data.assets)
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

  function startEdit(a: AssetRow) {
    setEditingId(a.id)
    setEditName(a.name)
    setEditColor(normalizePresetColor(a.color))
    setEditError(null)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditError(null)
  }

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

  async function onSaveEdit(e: FormEvent) {
    e.preventDefault()
    if (!editingId) return
    setEditError(null)
    setEditSaving(true)
    try {
      const res = await apiJson<{ asset: AssetRow }>(`/api/assets/${editingId}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: editName.trim(), color: editColor }),
      })
      setAssets((prev) => prev.map((x) => (x.id === res.asset.id ? res.asset : x)))
      cancelEdit()
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
    if (!target) return
    try {
      await apiJson<{ ok: boolean }>(`/api/assets/${target.id}`, { method: 'DELETE' })
      setAssets((prev) => prev.filter((x) => x.id !== target.id))
      if (editingId === target.id) cancelEdit()
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 401) {
        setDeleteTarget(null)
        void navigate('/login', { replace: true })
        return
      }
      if (err instanceof ApiError) throw err
      throw new Error('Could not delete asset')
    }
  }

  const deleteModalOpen = deleteTarget != null
  const blockListActions = deleteModalOpen || editSaving

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
      <h1>Assets</h1>
      <p className="muted">Only you can see assets on this account.</p>

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
                <li key={a.id} className={`asset-card${editingId === a.id ? ' asset-card--editing' : ''}`}>
                  {editingId === a.id ? (
                    <form className="asset-card-edit" onSubmit={(ev) => void onSaveEdit(ev)}>
                      <label className="field">
                        <span>Name</span>
                        <input value={editName} onChange={(ev) => setEditName(ev.target.value)} required maxLength={120} />
                      </label>
                      <div className="field">
                        <span>Color</span>
                        <AssetColorPresets value={editColor} onChange={setEditColor} groupLabel={`Color for ${editName || 'asset'}`} />
                      </div>
                      {editError != null && <p className="error">{editError}</p>}
                      <div className="asset-card-edit-actions">
                        <button type="button" className="btn" onClick={cancelEdit} disabled={editSaving}>
                          Cancel
                        </button>
                        <button type="submit" className="btn primary" disabled={editSaving}>
                          {editSaving ? 'Saving…' : 'Save'}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <span className="asset-swatch" style={{ backgroundColor: a.color }} title={assetColorLabel(a.color)} />
                      <div className="asset-meta">
                        <span className="asset-name">{a.name}</span>
                        <span className="muted asset-date">{formatAssetDate(a.createdAt)}</span>
                      </div>
                      <div className="asset-actions">
                        <button
                          type="button"
                          className="btn"
                          onClick={() => startEdit(a)}
                          disabled={blockListActions || (editingId != null && editingId !== a.id)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger"
                          onClick={() => setDeleteTarget(a)}
                          disabled={blockListActions}
                        >
                          Delete
                        </button>
                      </div>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <ConfirmModal
        open={deleteModalOpen}
        title="Delete asset?"
        description={
          deleteTarget != null
            ? `Permanently remove “${deleteTarget.name}”? This cannot be undone.`
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
