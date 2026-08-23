import React, { useEffect, useRef, useState } from 'react'
import { Trash2 } from 'lucide-react'

export default function DeleteConfirmDialog({
  title,
  message,
  confirmLabel = 'Delete',
  onCancel,
  onConfirm,
}) {
  const [closing, setClosing] = useState(false)
  const cancelRef = useRef(null)

  const finish = (callback) => {
    if (closing) return
    setClosing(true)
    window.setTimeout(callback, 180)
  }

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    const onKeyDown = (event) => {
      if (event.key === 'Escape') finish(onCancel)
    }
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', onKeyDown)
    window.requestAnimationFrame?.(() => cancelRef.current?.focus())
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [onCancel])

  return <div
    className={`delete-confirm-layer ${closing ? 'closing' : ''}`}
    role="presentation"
    onMouseDown={(event) => event.target === event.currentTarget && finish(onCancel)}
  >
    <section
      className="delete-confirm-dialog"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="delete-confirm-title"
      aria-describedby="delete-confirm-message"
    >
      <div className="delete-confirm-icon" aria-hidden="true"><Trash2 size={20} /></div>
      <div className="delete-confirm-copy">
        <h2 id="delete-confirm-title">{title}</h2>
        <p id="delete-confirm-message">{message}</p>
      </div>
      <div className="delete-confirm-actions">
        <button ref={cancelRef} type="button" className="delete-confirm-cancel" onClick={() => finish(onCancel)}>
          Cancel
        </button>
        <button type="button" className="delete-confirm-delete" onClick={() => finish(onConfirm)}>
          {confirmLabel}
        </button>
      </div>
    </section>
  </div>
}
