import { type Dispatch, type MouseEvent, type SetStateAction, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { APP_INTL_LOCALE } from '../intl/appLocale'

export type BulkDraftRow = {
  assetId: string
  name: string
  color: string
  prefillDeposit: string
  prefillBalance: string
  blocked: boolean
  blockReason: 'month_exists' | null
}

export type BulkDraftResponse = {
  year: number
  month: number
  rows: BulkDraftRow[]
}

function formatBulkMonthLabel(year: number, month: number) {
  return new Date(year, month - 1, 1).toLocaleString(APP_INTL_LOCALE, { month: 'long', year: 'numeric' })
}

export type BulkImportModalProps = {
  open: boolean
  onClose: () => void
  draftLoading: boolean
  draftLoadError: string | null
  draft: BulkDraftResponse | null
  bulkValues: Record<string, { deposit: string; balance: string }>
  setBulkValues: Dispatch<SetStateAction<Record<string, { deposit: string; balance: string }>>>
  bulkUiError: string | null
  bulkSubmitting: boolean
  onSubmit: () => void
}

export function BulkImportModal({
  open,
  onClose,
  draftLoading,
  draftLoadError,
  draft,
  bulkValues,
  setBulkValues,
  bulkUiError,
  bulkSubmitting,
  onSubmit,
}: BulkImportModalProps) {
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
    if (bulkSubmitting) return
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <dialog ref={dialogRef} className="modal-dialog bulk-import-modal" aria-labelledby="bulk-import-modal-title">
      <div className="modal-wrap bulk-import-modal-wrap" onClick={backdropClick}>
        <div className="modal-panel modal-panel--wide bulk-import-modal-panel" role="document">
          <h2 id="bulk-import-modal-title" className="modal-title">
            Bulk import
            {draft != null && !draftLoading ? ` — ${formatBulkMonthLabel(draft.year, draft.month)}` : null}
          </h2>
          <p className="muted modal-lead">
            Prefilled from each asset’s latest log (empty if none). This month is fixed to today’s calendar month. Rows that
            already have a log for this month are read-only.
          </p>

          {draftLoading ? <p className="muted">Loading…</p> : null}
          {!draftLoading && draftLoadError != null ? <p className="error">{draftLoadError}</p> : null}

          {!draftLoading && draftLoadError == null && draft != null ? (
            <>
              {draft.rows.length === 0 ? (
                <p className="muted">No active assets.</p>
              ) : (
                <div className="assets-bulk-table-wrap bulk-import-modal-table">
                  <table className="assets-bulk-table">
                    <thead>
                      <tr>
                        <th>Asset</th>
                        <th className="assets-bulk-table__num">Deposit</th>
                        <th className="assets-bulk-table__num">Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {draft.rows.map((r) => {
                        const v = bulkValues[r.assetId] ?? { deposit: '', balance: '' }
                        return (
                          <tr key={r.assetId} className={r.blocked ? 'assets-bulk-row--blocked' : undefined}>
                            <td>
                              <div className="assets-bulk-asset-cell">
                                <span className="asset-swatch" style={{ backgroundColor: r.color }} title={r.name} />
                                <Link to={`/assets/${r.assetId}`} onClick={() => onClose()}>
                                  {r.name}
                                </Link>
                              </div>
                              {r.blocked ? (
                                <p className="assets-bulk-blocked-note muted">This month already has a log — edit on the asset page.</p>
                              ) : null}
                            </td>
                            <td className="assets-bulk-table__num">
                              <input
                                className="assets-bulk-input"
                                value={v.deposit}
                                onChange={(ev) =>
                                  setBulkValues((prev) => ({
                                    ...prev,
                                    [r.assetId]: { ...v, deposit: ev.target.value },
                                  }))
                                }
                                inputMode="decimal"
                                disabled={r.blocked || bulkSubmitting}
                              />
                            </td>
                            <td className="assets-bulk-table__num">
                              <input
                                className="assets-bulk-input"
                                value={v.balance}
                                onChange={(ev) =>
                                  setBulkValues((prev) => ({
                                    ...prev,
                                    [r.assetId]: { ...v, balance: ev.target.value },
                                  }))
                                }
                                inputMode="decimal"
                                disabled={r.blocked || bulkSubmitting}
                              />
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              {bulkUiError != null ? <p className="error">{bulkUiError}</p> : null}
            </>
          ) : null}

          <div className="modal-actions bulk-import-modal-actions">
            <button type="button" className="btn" onClick={onClose} disabled={bulkSubmitting}>
              Cancel
            </button>
            <button
              type="button"
              className="btn primary"
              onClick={() => void onSubmit()}
              disabled={bulkSubmitting || draftLoading || draftLoadError != null || draft == null}
            >
              {bulkSubmitting ? 'Saving…' : 'Save all logs'}
            </button>
          </div>
        </div>
      </div>
    </dialog>
  )
}
