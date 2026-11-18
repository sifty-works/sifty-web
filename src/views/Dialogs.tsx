/**
 * Dialogs.tsx — modal dialogs for Apply outcome and permanent deletion.
 *
 * Neither dialog closes on Escape; the user must make an explicit choice.
 */
import React from 'react'

/** Outcome the user selected in the Apply outcome dialog. */
export type ApplyOutcome =
  | { kind: 'not_yet' }
  | { kind: 'dismissed'; reason: string }
  | { kind: 'applied' }

interface ApplyOutcomeDialogProps {
  note: string | null
  saving: boolean
  error: string | null
  onDecide: (outcome: ApplyOutcome) => void
}

/**
 * "Did you submit your application?" dialog, shown after Apply is clicked.
 * Escape is suppressed; the user must pick an answer.
 */
export function ApplyOutcomeDialog({ note, saving, error, onDecide }: ApplyOutcomeDialogProps) {
  function prevent(e: React.KeyboardEvent) {
    if (e.key === 'Escape') e.preventDefault()
  }

  return (
    <div className="dialog-backdrop" onKeyDown={prevent}>
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="apply-dialog-title">
        <h3 id="apply-dialog-title" className="dialog__title">Did you submit your application?</h3>
        {note && <p className="dialog__note">{note}</p>}
        {error && (
          <p className="dialog__error">
            The outcome could not be saved. The role has not been changed by this action. Try again,
            or close this dialog to review the error.
            <span className="dialog__error-detail"> {error}</span>
          </p>
        )}
        <div className="dialog__actions">
          <button
            className="btn-action"
            disabled={saving}
            onClick={() => onDecide({ kind: 'not_yet' })}
          >
            Not yet
          </button>
          <button
            className="btn-action"
            disabled={saving}
            onClick={() => onDecide({ kind: 'dismissed', reason: 'vacancy is stale' })}
          >
            No, vacancy is stale
          </button>
          <button
            className="btn-action"
            disabled={saving}
            onClick={() => onDecide({ kind: 'dismissed', reason: 'vacancy is closed' })}
          >
            No, vacancy is closed
          </button>
          <button
            className="btn-action"
            disabled={saving}
            onClick={() => onDecide({ kind: 'dismissed', reason: 'not suitable' })}
          >
            No, not suitable
          </button>
          <button
            className="btn-action btn-action--primary"
            disabled={saving}
            onClick={() => onDecide({ kind: 'applied' })}
          >
            Yes, applied
          </button>
        </div>
      </div>
    </div>
  )
}

interface DeleteConfirmDialogProps {
  saving: boolean
  error: string | null
  onKeep: () => void
  onDelete: () => void
}

/**
 * Permanent deletion confirmation dialog.
 * Escape is suppressed; the user must click Keep role or Permanently delete.
 */
export function DeleteConfirmDialog({ saving, error, onKeep, onDelete }: DeleteConfirmDialogProps) {
  function prevent(e: React.KeyboardEvent) {
    if (e.key === 'Escape') e.preventDefault()
  }

  return (
    <div className="dialog-backdrop" onKeyDown={prevent}>
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="delete-dialog-title">
        <h3 id="delete-dialog-title" className="dialog__title">Delete this role permanently?</h3>
        <p className="dialog__body">
          This permanently deletes this role, its answers and application history. This cannot be
          undone. Automatic collection will not restore it.
        </p>
        {error && <p className="dialog__error">{error}</p>}
        <div className="dialog__actions">
          <button className="btn-action" disabled={saving} onClick={onKeep}>
            Keep role
          </button>
          <button
            className="btn-action btn-action--danger"
            disabled={saving}
            onClick={onDelete}
          >
            Permanently delete
          </button>
        </div>
      </div>
    </div>
  )
}
