import { Dispatch, SetStateAction, useCallback, useEffect, useMemo, useState } from 'react'
import {
  listSources,
  addSource,
  patchSource,
  deleteSource,
  setSchedule,
  Source,
  SourceListResponse,
  ServerError,
  OfflineError,
} from '../api/client.ts'

export type SourcesState =
  | { status: 'loading' }
  | { status: 'offline' }
  | { status: 'ok'; sources: Source[]; auto: boolean; interval: string }
  | { status: 'error'; message: string }

export interface UseSourcesResult {
  state: SourcesState
  add: (name: string, url: string) => Promise<boolean>
  toggle: (key: string, enabled: boolean) => Promise<void>
  remove: (key: string) => Promise<void>
  updateSchedule: (auto: boolean, interval: string) => Promise<void>
  addError: string | null
}

function applyList(
  setState: Dispatch<SetStateAction<SourcesState>>,
  data: SourceListResponse,
) {
  setState({ status: 'ok', sources: data.sources, auto: data.auto, interval: data.interval })
}

function offlineOrError(
  setState: Dispatch<SetStateAction<SourcesState>>,
  err: unknown,
) {
  if (err instanceof ServerError) {
    setState({ status: 'error', message: err.message })
  } else {
    setState({ status: 'offline' })
  }
}

export function useSources(): UseSourcesResult {
  const [state, setState] = useState<SourcesState>({ status: 'loading' })
  const [addError, setAddError] = useState<string | null>(null)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let cancelled = false
    setState({ status: 'loading' })
    listSources()
      .then((data) => { if (!cancelled) applyList(setState, data) })
      .catch((err: unknown) => { if (!cancelled) offlineOrError(setState, err) })
    return () => { cancelled = true }
  }, [version])

  const add = useCallback(async (name: string, url: string): Promise<boolean> => {
    setAddError(null)
    try {
      const data = await addSource(name, url)
      applyList(setState, data)
      return true
    } catch (err) {
      if (err instanceof ServerError) {
        setAddError(err.message)
      } else if (err instanceof OfflineError) {
        setState({ status: 'offline' })
      }
      return false
    }
  }, [])

  // A change answers the whole list; on failure the list is loaded again.
  const change = useCallback(<A extends unknown[]>(call: (...a: A) => Promise<SourceListResponse>) =>
    async (...a: A): Promise<void> => {
      try {
        applyList(setState, await call(...a))
      } catch {
        setVersion((v) => v + 1)
      }
    }, [])
  const toggle = useMemo(() => change(patchSource), [change])
  const remove = useMemo(() => change(deleteSource), [change])
  const updateSchedule = useMemo(() => change(setSchedule), [change])

  return { state, add, toggle, remove, updateSchedule, addError }
}
