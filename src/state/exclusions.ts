import { useCallback, useEffect, useState } from 'react'
import {
  Exclusion,
  ExclusionListResponse,
  listExclusions,
  addExclusion,
  removeExclusion,
  ServerError,
} from '../api/client.ts'
import { failure, type Note } from './messages.ts'

export type ExclusionState =
  | { status: 'loading' }
  | { status: 'offline' }
  | { status: 'ok'; exclusions: Exclusion[] }

function applyResponse(d: ExclusionListResponse): ExclusionState {
  return { status: 'ok', exclusions: d.exclusions ?? [] }
}

export function useExclusions() {
  const [state, setState] = useState<ExclusionState>({ status: 'loading' })
  const [addNote, setAddNote] = useState<Note | null>(null)

  useEffect(() => {
    listExclusions()
      .then((d) => setState(applyResponse(d)))
      .catch(() => setState({ status: 'offline' }))
  }, [])

  const add = useCallback(async (kind: string, value: string): Promise<boolean> => {
    setAddNote(null)
    try {
      const d = await addExclusion(kind, value)
      setState(applyResponse(d))
      return true
    } catch (err) {
      setAddNote(failure(err instanceof ServerError ? err : null, 'Could not add exclusion.'))
      return false
    }
  }, [])

  const remove = useCallback(async (id: number): Promise<void> => {
    try {
      const d = await removeExclusion(id)
      setState(applyResponse(d))
    } catch {
    }
  }, [])

  return { state, add, remove, addNote }
}
