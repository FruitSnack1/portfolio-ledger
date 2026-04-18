import { type FormEvent, type MouseEvent, useEffect, useRef } from 'react'
import { AssetColorPresets } from './AssetColorPresets'

type NewAssetModalProps = {
  open: boolean
  onClose: () => void
  name: string
  color: string
  onNameChange: (value: string) => void
  onColorChange: (value: string) => void
  formError: string | null
  saving: boolean
  onSubmit: (e: FormEvent) => void
}

export function NewAssetModal({
  open,
  onClose,
  name,
  color,
  onNameChange,
  onColorChange,
  formError,
  saving,
  onSubmit,
}: NewAssetModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const el = dialogRef.current
    if (!el) return
    if (open && !el.open) el.showModal()
    if (!open && el.open) el.close()
  }, [open])

  useEffect(() => {
    const el = dialogRef.current
    if (!el) return
    const onDialogClose = () => onClose()
    el.addEventListener('close', onDialogClose)
    return () => el.removeEventListener('close', onDialogClose)
  }, [onClose])

  function backdropClick(e: MouseEvent<HTMLDivElement>) {
    if (saving) return
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <dialog ref={dialogRef} className="modal-dialog new-asset-modal" aria-labelledby="new-asset-modal-title">
      <div className="modal-wrap" onClick={backdropClick}>
        <div className="modal-panel asset-add-log-modal-panel" role="document">
          <h2 id="new-asset-modal-title" className="modal-title">
            New asset
          </h2>
          <p className="muted modal-lead">Pick a name and color — presets stay consistent on charts.</p>
          <form className="form" onSubmit={(ev) => void onSubmit(ev)}>
            <label className="field">
              <span>Name</span>
              <input
                value={name}
                onChange={(ev) => onNameChange(ev.target.value)}
                required
                maxLength={120}
                placeholder="e.g. S&P 500 ETF"
                disabled={saving}
                autoComplete="off"
              />
            </label>
            <div className="field">
              <span>Color</span>
              <AssetColorPresets value={color} onChange={onColorChange} groupLabel="New asset color" disabled={saving} />
            </div>
            {formError != null && <p className="error">{formError}</p>}
            <div className="modal-actions">
              <button type="button" className="btn" onClick={onClose} disabled={saving}>
                Cancel
              </button>
              <button type="submit" className="btn primary" disabled={saving}>
                {saving ? 'Saving…' : 'Create asset'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </dialog>
  )
}
