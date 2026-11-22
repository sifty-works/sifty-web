import { useEffect, useRef } from 'react'

export type Visual = 'retry' | 'broken' | 'decide' | 'info'

export interface Note {
  kind: 'report' | 'failure'
  text: string
  id?: number
}

const REPORT_MS = 5000
const EMPTY_TEXT = 'Could not save'

const standing: { dismiss: () => void }[] = []
let issued = 0

export function describe(e: unknown, fallback = EMPTY_TEXT): string {
  const text = typeof e === 'string' ? e : e instanceof Error ? e.message : ''
  return text.trim() || fallback
}

export function failure(e: unknown, fallback?: string): Note {
  return { kind: 'failure', text: describe(e, fallback), id: ++issued }
}

export function report(text: string): Note {
  return { kind: 'report', text, id: ++issued }
}

function dismissNewest(e: KeyboardEvent) {
  if (e.key === 'Escape') standing[standing.length - 1]?.dismiss()
}

interface Props {
  note: Note | null | undefined
  onDismiss: () => void
  visual?: Visual
  className?: string
}

export function Message({ note, onDismiss, visual, className }: Props) {
  const latest = useRef(onDismiss)
  latest.current = onDismiss
  const kind = note?.kind
  const text = note?.text
  const id = note?.id

  useEffect(() => {
    if (!kind) return
    const entry = { dismiss: () => latest.current() }
    if (standing.push(entry) === 1) document.addEventListener('keydown', dismissNewest)
    const timer = kind === 'report' ? setTimeout(entry.dismiss, REPORT_MS) : undefined
    return () => {
      clearTimeout(timer)
      standing.splice(standing.indexOf(entry), 1)
      if (standing.length === 0) document.removeEventListener('keydown', dismissNewest)
    }
  }, [kind, text, id])

  if (!note) return null
  const shape = visual ?? (note.kind === 'failure' ? 'retry' : 'info')
  return (
    <div className={`msg ${shape}${className ? ` ${className}` : ''}`} role={note.kind === 'failure' ? 'alert' : 'status'}>
      {note.text.trim() || EMPTY_TEXT}
      <button type="button" aria-label="Dismiss" onClick={onDismiss}>×</button>
    </div>
  )
}
