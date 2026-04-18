import { type FormEvent, type MouseEvent, useEffect, useRef, useState } from 'react'
import type { NavigateFunction } from 'react-router-dom'
import { ApiError, apiJson } from '../api/client'

export type CsvImportResponse = {
  createdLogs: number
  updatedLogs: number
  failed: { line: number; detail: string }[]
  assetsCreated: { id: string; name: string }[]
}

type CsvImportModalProps = {
  open: boolean
  onClose: () => void
  onComplete: (result: CsvImportResponse) => void
  navigate: NavigateFunction
}

export function CsvImportModal({ open, onClose, onComplete, navigate }: CsvImportModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [pasted, setPasted] = useState('')
  const [fileLabel, setFileLabel] = useState<string | null>(null)
  const [fileText, setFileText] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

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
    if (!open) return
    setPasted('')
    setFileLabel(null)
    setFileText(null)
    setError(null)
    setSubmitting(false)
    if (fileRef.current) fileRef.current.value = ''
  }, [open])

  function backdropClick(e: MouseEvent<HTMLDivElement>) {
    if (submitting) return
    if (e.target === e.currentTarget) onClose()
  }

  async function onFileChange() {
    const f = fileRef.current?.files?.[0]
    if (!f) {
      setFileLabel(null)
      setFileText(null)
      return
    }
    setFileLabel(f.name)
    try {
      const text = await f.text()
      setFileText(text)
    } catch {
      setFileText(null)
      setError('Could not read the file')
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const csv = fileText != null && fileText.trim().length > 0 ? fileText.trim() : pasted.trim()
    if (csv.length === 0) {
      setError('Choose a CSV file or paste CSV content')
      return
    }
    setSubmitting(true)
    try {
      const result = await apiJson<CsvImportResponse>('/api/logs/import-csv', {
        method: 'POST',
        body: JSON.stringify({ csv }),
      })
      onComplete(result)
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 401) {
        void navigate('/login', { replace: true })
        return
      }
      if (err instanceof ApiError) setError(err.message)
      else setError('Import failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <dialog ref={dialogRef} className="modal-dialog csv-import-modal" aria-labelledby="csv-import-title">
      <div className="modal-wrap" onClick={backdropClick}>
        <div className="modal-panel csv-import-modal-panel" role="document">
          <h2 id="csv-import-title" className="modal-title">
            Import CSV
          </h2>
          <p className="muted modal-lead">
            <strong>Column order</strong> (header labels ignored): 1) date, 2) asset name, 3) deposit, 4) balance. If the
            first row does not parse as data, it is skipped as a header. Dates: <code>YYYY-MM-DD</code>, <code>5/24</code>{' '}
            (May 2024), <code>M/D/YYYY</code>, or <code>M/YYYY</code>. Asset names match existing assets (case-insensitive);
            unknown names create a new asset with a random preset color.
          </p>
          <form className="form csv-import-form" onSubmit={(ev) => void onSubmit(ev)}>
            <label className="field">
              <span>CSV file</span>
              <input ref={fileRef} type="file" accept=".csv,text/csv" className="csv-import-file" onChange={() => void onFileChange()} disabled={submitting} />
              {fileLabel != null && <p className="hint">{fileLabel}</p>}
            </label>
            <label className="field">
              <span>Or paste CSV</span>
              <textarea
                value={pasted}
                onChange={(ev) => setPasted(ev.target.value)}
                rows={8}
                className="csv-import-textarea"
                placeholder="2024-05-01,My fund,1000,10500"
                disabled={submitting}
              />
            </label>
            {error != null && <p className="error">{error}</p>}
            <div className="modal-actions">
              <button type="button" className="btn" onClick={onClose} disabled={submitting}>
                Cancel
              </button>
              <button type="submit" className="btn primary" disabled={submitting}>
                {submitting ? 'Importing…' : 'Import'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </dialog>
  )
}
