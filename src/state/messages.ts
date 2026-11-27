import { toast } from 'sonner'

export interface Note {
  kind: 'report' | 'failure'
  text: string
}

export interface NoteAction {
  label: string
  onClick: () => void
}

export const EMPTY_TEXT = 'Could not save'

const REPORT_MS = 5000

const standing: string[] = []
const shown = new Map<string, string>()

function forget(place: string): boolean {
  shown.delete(place)
  const at = standing.indexOf(place)
  if (at >= 0) standing.splice(at, 1)
  return at >= 0
}

export function describe(e: unknown, fallback = EMPTY_TEXT): string {
  const text = typeof e === 'string' ? e : e instanceof Error ? e.message : ''
  return text.trim() || fallback
}

export function failure(e: unknown, fallback?: string): Note {
  return { kind: 'failure', text: describe(e, fallback) }
}

export function announce(note: Note, place: string, action?: NoteAction) {
  const text = note.text.trim() || EMPTY_TEXT
  for (const [other, said] of shown) if (other !== place && said === text) retract(other)
  forget(place)
  standing.push(place)
  shown.set(place, text)
  const options = {
    id: place,
    duration: note.kind === 'report' ? REPORT_MS : Infinity,
    action,
    onDismiss: () => forget(place),
    onAutoClose: () => forget(place),
  }
  if (note.kind === 'report') toast.success(text, options)
  else toast.error(text, options)
}

export function retract(place: string) {
  if (forget(place)) toast.dismiss(place)
}

export function dismissNewest() {
  const place = standing.pop()
  if (place !== undefined) toast.dismiss(place)
}

export function silent(reason: string): () => void {
  void reason
  return () => {}
}
