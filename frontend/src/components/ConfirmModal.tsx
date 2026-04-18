import { type MouseEvent, useEffect, useRef, useState } from 'react'

export type ConfirmModalProps = {
  open: boolean
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  /** When true, the confirm action uses destructive styling. */
  danger?: boolean
  onClose: () => void
  /** Called when the user confirms; throw on failure so the modal can show an error. */
  onConfirm: () => void | Promise<void>
}

export function ConfirmModal({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  onClose,
  onConfirm,
}: ConfirmModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setError(null)
    setWorking(false)
  }, [open])

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
    if (working) return
    if (e.target === e.currentTarget) onClose()
  }

  async function handleConfirm() {
    if (working) return
    setWorking(true)
    setError(null)
    try {
      await onConfirm()
      onClose()
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message)
      else setError('Something went wrong')
    } finally {
      setWorking(false)
    }
  }

  return (
    <dialog ref={dialogRef} className="modal-dialog" aria-labelledby="confirm-modal-title">
      <div className="modal-wrap" onClick={backdropClick}>
        <div className="modal-panel" role="document">
          <h2 id="confirm-modal-title" className="modal-title">
            {title}
          </h2>
          <p className="muted modal-lead">{description}</p>
          {error != null && <p className="error">{error}</p>}
          <div className="modal-actions">
            <button type="button" className="btn" onClick={onClose} disabled={working}>
              {cancelLabel}
            </button>
            <button
              type="button"
              className={danger ? 'btn btn-danger-solid' : 'btn primary'}
              onClick={() => void handleConfirm()}
              disabled={working}
            >
              {working ? 'Please wait…' : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </dialog>
  )
}
