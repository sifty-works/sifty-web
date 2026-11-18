import { useEffect, useRef, useState } from 'react'
import type { Outcome } from '../api/client.ts'

interface ApplyOutcomeDialogProps {
  title: string
  company: string
  note: string | null
  outcomes: Outcome[]
  saving: boolean
  error: string | null
  onDecide: (outcome: Outcome) => void
}

export function ApplyOutcomeDialog({ title, company, note, outcomes, saving, error, onDecide }: ApplyOutcomeDialogProps) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [pending, setPending] = useState<string | null>(null)

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const element = dialog.current
    element?.showModal()
    return () => {
      element?.close()
      if (previous?.isConnected) previous.focus()
    }
  }, [])

  async function decide(outcome: Outcome) {
    if (pending !== null) return
    setPending(outcome.key)
    onDecide(outcome)
  }

  return (
    <dialog
      ref={dialog}
      className="application-confirmation"
      aria-labelledby="application-question"
      aria-describedby="application-explanation"
      onCancel={(e) => e.preventDefault()}
    >
      <h2 id="application-question">Did you submit your application?</h2>
      <p>{title} · {company}</p>
      {note && <p>{note}</p>}
      <p id="application-explanation" className="muted">
        Opening the employer page does not submit an application. Confirm only
        after you have submitted it yourself. You can also confirm later from
        Shortlist. Choose a negative outcome only if you will not apply.
      </p>
      {error && (
        <p className="error" role="alert">
          The outcome could not be saved. The role has not been changed by this
          action. Try again, or close this dialog to review the error.
        </p>
      )}
      <div className="confirmation-actions">
        {outcomes.map((outcome) => (
          <button
            key={outcome.key}
            type="button"
            disabled={saving}
            className={outcome.confirmed ? 'primary' : undefined}
            onClick={() => void decide(outcome)}
          >
            {pending === outcome.key ? 'Saving…' : outcome.label}
          </button>
        ))}
      </div>
    </dialog>
  )
}

interface DeleteConfirmDialogProps {
  title: string
  company: string
  saving: boolean
  error: string | null
  onKeep: () => void
  onDelete: () => void
}

export function DeleteConfirmDialog({ title, company, saving, error, onKeep, onDelete }: DeleteConfirmDialogProps) {
  const dialog = useRef<HTMLDialogElement>(null)
  const pending = useRef(false)

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    dialog.current?.showModal()
    return () => {
      if (previous?.isConnected) previous.focus()
    }
  }, [])

  return (
    <dialog
      ref={dialog}
      className="delete-role"
      aria-labelledby="delete-role-title"
      onCancel={(e) => { if (pending.current) e.preventDefault(); else onKeep() }}
    >
      <h2 id="delete-role-title">Delete {title}?</h2>
      <p>{company}</p>
      <p>This permanently deletes this role, its answers and application history. This cannot be undone. Automatic collection will not restore it.</p>
      <p className="muted">Remembered candidate facts and shared files remain available.</p>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="draft-actions">
        <button autoFocus disabled={saving} onClick={onKeep}>Keep role</button>
        <button className="no-button" disabled={saving} onClick={() => { if (pending.current) return; pending.current = true; onDelete() }}>
          {saving ? 'Deleting…' : 'Permanently delete'}
        </button>
      </div>
    </dialog>
  )
}
