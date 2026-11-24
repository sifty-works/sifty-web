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
  | { status: 'error'; message: string }
  | { status: 'ok'; exclusions: Exclusion[] }

function applyResponse(d: ExclusionListResponse): ExclusionState {
  return { status: 'ok', exclusions: d.exclusions ?? [] }
}

export function useExclusions() {
  const [state, setState] = useState<ExclusionState>({ status: 'loading' })
  const [note, setNote] = useState<Note | null>(null)

  useEffect(() => {
    listExclusions()
      .then((d) => setState(applyResponse(d)))
      .catch((err: unknown) => {
        if (err instanceof ServerError) {
          setState({ status: 'error', message: err.message })
          setNote(failure(err))
        } else {
          setState({ status: 'offline' })
        }
      })
  }, [])

  const add = useCallback(async (kind: string, value: string): Promise<boolean> => {
    setNote(null)
    try {
      const d = await addExclusion(kind, value)
      setState(applyResponse(d))
      return true
    } catch (err) {
      setNote(failure(err instanceof ServerError ? err : null, 'Could not add exclusion.'))
      return false
    }
  }, [])

  const remove = useCallback(async (id: number): Promise<void> => {
    setNote(null)
    try {
      const d = await removeExclusion(id)
      setState(applyResponse(d))
    } catch (err) {
      setNote(failure(err instanceof ServerError ? err : null, 'Could not remove exclusion.'))
    }
  }, [])

  return { state, add, remove, note }
}
