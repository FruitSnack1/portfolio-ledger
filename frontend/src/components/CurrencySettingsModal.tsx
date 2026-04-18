import { type FormEvent, type MouseEvent, useEffect, useRef, useState } from 'react'
import { ApiError, apiJson } from '../api/client'
import { CURRENCY_OPTIONS } from '../currency/supportedCurrencies'

export type UserWithCurrency = {
  id: string
  email: string
  displayCurrency: string | null
}

type CurrencySettingsModalProps = {
  open: boolean
  mandatory: boolean
  displayCurrency: string | null
  onClose: () => void
  onSaved: (user: UserWithCurrency) => void
}

export function CurrencySettingsModal({
  open,
  mandatory,
  displayCurrency,
  onClose,
  onSaved,
}: CurrencySettingsModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [code, setCode] = useState(() => displayCurrency ?? 'USD')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setCode(displayCurrency ?? 'USD')
    setError(null)
  }, [open, displayCurrency])

  useEffect(() => {
    const el = dialogRef.current
    if (!el) return
    if (open && !el.open) el.showModal()
    if (!open && el.open) el.close()
  }, [open])

  useEffect(() => {
    const el = dialogRef.current
    if (!el) return
    const onCancel = (e: Event) => {
      if (mandatory) e.preventDefault()
    }
    el.addEventListener('cancel', onCancel)
    return () => el.removeEventListener('cancel', onCancel)
  }, [mandatory])

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      const res = await apiJson<{ user: UserWithCurrency }>('/api/auth/me', {
        method: 'PATCH',
        body: JSON.stringify({ displayCurrency: code }),
      })
      onSaved(res.user)
      onClose()
    } catch (err: unknown) {
      if (err instanceof ApiError) setError(err.message)
      else setError('Could not save')
    } finally {
      setSaving(false)
    }
  }

  function backdropClick(e: MouseEvent<HTMLDivElement>) {
    if (mandatory) return
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <dialog ref={dialogRef} className="modal-dialog" aria-labelledby="currency-modal-title">
      <div className="modal-wrap" onClick={backdropClick}>
        <div className="modal-panel" role="document">
          <h2 id="currency-modal-title" className="modal-title">
            Display currency
          </h2>
          <p className="muted modal-lead">
            {mandatory
              ? 'Choose the currency used to show amounts across your portfolio.'
              : 'Change how amounts are shown in the app.'}
          </p>
          <form className="modal-form" onSubmit={(ev) => void submit(ev)}>
            <label className="field">
              <span>Currency</span>
              <select value={code} onChange={(ev) => setCode(ev.target.value)} required>
                {CURRENCY_OPTIONS.map((opt) => (
                  <option key={opt.code} value={opt.code}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
            {error != null && <p className="error">{error}</p>}
            <div className="modal-actions">
              {!mandatory && (
                <button type="button" className="btn" onClick={onClose} disabled={saving}>
                  Cancel
                </button>
              )}
              <button type="submit" className="btn primary" disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </dialog>
  )
}
