import { useCallback, useEffect, useState } from 'react'
import {
  Exclusion,
  ExclusionListResponse,
  listExclusions,
  addExclusion,
  removeExclusion,
  ServerError,
} from '../api/client.ts'

export type ExclusionState =
  | { status: 'loading' }
  | { status: 'offline' }
  | { status: 'ok'; exclusions: Exclusion[] }

function applyResponse(d: ExclusionListResponse): ExclusionState {
  return { status: 'ok', exclusions: d.exclusions ?? [] }
}

export function useExclusions() {
  const [state, setState] = useState<ExclusionState>({ status: 'loading' })
  const [addError, setAddError] = useState<string | null>(null)

  useEffect(() => {
    listExclusions()
      .then((d) => setState(applyResponse(d)))
      .catch(() => setState({ status: 'offline' }))
  }, [])

  const add = useCallback(async (kind: string, value: string): Promise<boolean> => {
    setAddError(null)
    try {
      const d = await addExclusion(kind, value)
      setState(applyResponse(d))
      return true
    } catch (err) {
      setAddError(err instanceof ServerError ? err.message : 'Could not add exclusion.')
      return false
    }
  }, [])

  const remove = useCallback(async (id: number): Promise<void> => {
    try {
      const d = await removeExclusion(id)
      setState(applyResponse(d))
    } catch {
      // ignore transient errors on remove
    }
  }, [])

  return { state, add, remove, addError }
}
