import type { Note } from '../state/messages.ts'

export function Refusal({ note }: { note: Note | null | undefined }) {
  if (!note) return null
  return <p className="refusal" role="alert">{note.text}</p>
}
