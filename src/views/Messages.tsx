import { useEffect, useRef, useState } from 'react'
import { EMPTY_TEXT, type Note } from '../state/messages.ts'

export type Visual = 'retry' | 'broken' | 'decide' | 'info'

const REPORT_MS = 5000

const standing: { dismiss: () => void }[] = []

function dismissNewest(e: KeyboardEvent) {
  if (e.key === 'Escape') standing[standing.length - 1]?.dismiss()
}

interface Props {
  note: Note | null | undefined
  visual?: Visual
  className?: string
  onDismiss?: () => void
}

export function Message({ note, ...rest }: Props) {
  if (!note) return null
  return <Standing key={`${note.id ?? ''}|${note.kind}|${note.text}`} note={note} {...rest} />
}

function Standing({ note, visual, className, onDismiss }: Props & { note: Note }) {
  const [gone, setGone] = useState(false)
  const notify = useRef(onDismiss)
  notify.current = onDismiss

  useEffect(() => {
    if (gone) return
    const entry = { dismiss: () => { setGone(true); notify.current?.() } }
    if (standing.push(entry) === 1) document.addEventListener('keydown', dismissNewest)
    const timer = note.kind === 'report' ? setTimeout(entry.dismiss, REPORT_MS) : undefined
    return () => {
      clearTimeout(timer)
      standing.splice(standing.indexOf(entry), 1)
      if (standing.length === 0) document.removeEventListener('keydown', dismissNewest)
    }
  }, [gone, note.kind])

  if (gone) return null
  const shape = visual ?? (note.kind === 'failure' ? 'retry' : 'info')
  return (
    <div className={`msg ${shape}${className ? ` ${className}` : ''}`} role={note.kind === 'failure' ? 'alert' : 'status'}>
      {note.text.trim() || EMPTY_TEXT}
      <button type="button" aria-label="Dismiss" onClick={() => { setGone(true); notify.current?.() }}>×</button>
    </div>
  )
}
