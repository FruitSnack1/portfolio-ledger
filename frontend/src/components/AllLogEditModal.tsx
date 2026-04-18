import { type FormEvent, type MouseEvent, useEffect, useRef, useState } from 'react'
import type { NavigateFunction } from 'react-router-dom'
import { ApiError, apiJson } from '../api/client'
import { formatDbNumericForInput } from '../asset/formatDbNumericForInput'
/** Row shape from `GET /api/logs` (same as `AllLogRow` on the logs page). */
export type AllLogEditRow = {
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

function buildYearOptions(maxYear: number) {
  const end = Math.max(2000, Math.min(2100, maxYear))
  return Array.from({ length: end - 1999 + 1 }, (_, i) => 2000 + i)
}

type AllLogEditModalProps = {
  log: AllLogEditRow | null
  onClose: () => void
  onSaved: () => void | Promise<void>
  navigate: NavigateFunction
}

export function AllLogEditModal({ log, onClose, onSaved, navigate }: AllLogEditModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const open = log != null

  const [year, setYear] = useState(2000)
  const [month, setMonth] = useState(1)
  const [deposit, setDeposit] = useState('')
  const [balance, setBalance] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

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

  useEffect(() => {
    if (!log) return
    setYear(log.year)
    setMonth(log.month)
    setDeposit(formatDbNumericForInput(log.deposit))
    setBalance(formatDbNumericForInput(log.balance))
    setError(null)
    setSaving(false)
  }, [log])

  function backdropClick(e: MouseEvent<HTMLDivElement>) {
    if (saving) return
    if (e.target === e.currentTarget) onClose()
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!log) return
    setError(null)
    const depositNum = Number(deposit)
    const balanceNum = Number(balance)
    if (!Number.isFinite(depositNum)) {
      setError('Enter a valid deposit amount')
      return
    }
    if (!Number.isFinite(balanceNum)) {
      setError('Enter a valid balance')
      return
    }
    setSaving(true)
    try {
      await apiJson<{ log: { id: string } }>(`/api/assets/${log.assetId}/logs/${log.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          year,
          month,
          deposit: depositNum,
          balance: balanceNum,
        }),
      })
      await onSaved()
      onClose()
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 401) {
        void navigate('/login', { replace: true })
        return
      }
      if (err instanceof ApiError) setError(err.message)
      else setError('Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  const yearNow = new Date().getFullYear()
  const endYear = Math.min(2100, yearNow + 1)
  const editYearMax = log != null ? Math.min(2100, Math.max(endYear, log.year, year)) : endYear
  const yearOptions = buildYearOptions(editYearMax)

  return (
    <dialog ref={dialogRef} className="modal-dialog all-log-edit-modal" aria-labelledby="all-log-edit-title">
      {log != null ? (
        <div className="modal-wrap" onClick={backdropClick}>
          <div className="modal-panel all-log-edit-modal-panel" role="document">
            <h2 id="all-log-edit-title" className="modal-title">
              Edit log
            </h2>
            <p className="muted modal-lead">
              <span className="all-log-edit-asset">
                <span className="all-log-edit-swatch" style={{ backgroundColor: log.assetColor }} aria-hidden />
                {log.assetName}
                {log.withdrawn ? ' · withdrawn' : ''}
              </span>
            </p>
            <form className="form all-log-edit-form" onSubmit={(ev) => void onSubmit(ev)}>
              <div className="field-row field-row--period">
                <label className="field">
                  <span>Year</span>
                  <select value={year} onChange={(ev) => setYear(Number(ev.target.value))} required disabled={saving}>
                    {yearOptions.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Month</span>
                  <select value={month} onChange={(ev) => setMonth(Number(ev.target.value))} required disabled={saving}>
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
                <input value={deposit} onChange={(ev) => setDeposit(ev.target.value)} inputMode="decimal" disabled={saving} />
              </label>
              <label className="field">
                <span>Balance</span>
                <input value={balance} onChange={(ev) => setBalance(ev.target.value)} inputMode="decimal" disabled={saving} />
              </label>
              {error != null && <p className="error">{error}</p>}
              <div className="modal-actions">
                <button type="button" className="btn" onClick={onClose} disabled={saving}>
                  Cancel
                </button>
                <button type="submit" className="btn primary" disabled={saving}>
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </dialog>
  )
}
