export interface Note {
  kind: 'report' | 'failure'
  text: string
  id?: number
}

export const EMPTY_TEXT = 'Could not save'

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

export function silent(reason: string): () => void {
  void reason
  return () => {}
}
