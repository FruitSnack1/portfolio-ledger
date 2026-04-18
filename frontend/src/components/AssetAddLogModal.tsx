import { type FormEvent, type MouseEvent, useEffect, useRef } from 'react'

export type AssetAddLogMonthOption = { value: number; label: string }

type AssetAddLogModalProps = {
  open: boolean
  onClose: () => void
  year: number
  month: number
  deposit: string
  balance: string
  onYearChange: (year: number) => void
  onMonthChange: (month: number) => void
  onDepositChange: (value: string) => void
  onBalanceChange: (value: string) => void
  yearOptions: readonly number[]
  monthOptions: readonly AssetAddLogMonthOption[]
  formError: string | null
  fieldsDisabled: boolean
  saving: boolean
  onSubmit: (e: FormEvent) => void
}

export function AssetAddLogModal({
  open,
  onClose,
  year,
  month,
  deposit,
  balance,
  onYearChange,
  onMonthChange,
  onDepositChange,
  onBalanceChange,
  yearOptions,
  monthOptions,
  formError,
  fieldsDisabled,
  saving,
  onSubmit,
}: AssetAddLogModalProps) {
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
    <dialog ref={dialogRef} className="modal-dialog asset-add-log-modal" aria-labelledby="asset-add-log-title">
      <div className="modal-wrap" onClick={backdropClick}>
        <div className="modal-panel asset-add-log-modal-panel" role="document">
          <h2 id="asset-add-log-title" className="modal-title">
            Add log
          </h2>
          <p className="muted modal-lead">One entry per calendar month: deposit and end-of-month balance.</p>
          <form className="form" onSubmit={(ev) => void onSubmit(ev)}>
            <div className="field-row field-row--period">
              <label className="field">
                <span>Year</span>
                <select
                  value={year}
                  onChange={(ev) => onYearChange(Number(ev.target.value))}
                  required
                  disabled={fieldsDisabled || saving}
                >
                  {yearOptions.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Month</span>
                <select
                  value={month}
                  onChange={(ev) => onMonthChange(Number(ev.target.value))}
                  required
                  disabled={fieldsDisabled || saving}
                >
                  {monthOptions.map((m) => (
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
                onChange={(ev) => onDepositChange(ev.target.value)}
                inputMode="decimal"
                placeholder="0"
                autoComplete="off"
                disabled={fieldsDisabled || saving}
              />
            </label>
            <label className="field">
              <span>Balance</span>
              <input
                value={balance}
                onChange={(ev) => onBalanceChange(ev.target.value)}
                inputMode="decimal"
                placeholder="0"
                autoComplete="off"
                disabled={fieldsDisabled || saving}
              />
            </label>
            {fieldsDisabled && (
              <p className="hint">Finish or cancel the row or asset edit before adding a log.</p>
            )}
            {formError != null && <p className="error">{formError}</p>}
            <div className="modal-actions">
              <button type="button" className="btn" onClick={onClose} disabled={saving}>
                Cancel
              </button>
              <button type="submit" className="btn primary" disabled={saving || fieldsDisabled}>
                {saving ? 'Saving…' : 'Save log'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </dialog>
  )
}
