import { useEffect } from 'react'
import { createPortal } from 'react-dom'

export type ToastProps = {
  message: string | null
  onRequestClear: () => void
  /** Auto-dismiss delay in ms. */
  durationMs?: number
}

export function Toast({ message, onRequestClear, durationMs = 4200 }: ToastProps) {
  useEffect(() => {
    if (!message) return
    const id = window.setTimeout(onRequestClear, durationMs)
    return () => window.clearTimeout(id)
  }, [message, onRequestClear, durationMs])

  if (!message) return null

  return createPortal(
    <div className="toast" role="status" aria-live="polite">
      {message}
    </div>,
    document.body,
  )
}
