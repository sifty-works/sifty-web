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
import { announce, failure, retract, type Note } from './messages.ts'

export type SourcesState =
  | { status: 'loading' }
  | { status: 'offline' }
  | { status: 'ok'; sources: Source[]; auto: boolean; interval: string; maxAgeMonths: number | null }
  | { status: 'error'; message: string }

export interface UseSourcesResult {
  state: SourcesState
  add: (name: string, url: string) => Promise<boolean>
  toggle: (key: string, enabled: boolean) => Promise<void>
  remove: (key: string) => Promise<void>
  updateSchedule: (auto: boolean, interval: string) => Promise<void>
  setAgeLimit: (maxAgeMonths: number | null) => Promise<Note | null>
  addNote: Note | null
}

function applyList(
  setState: Dispatch<SetStateAction<SourcesState>>,
  data: SourceListResponse,
) {
  setState({ status: 'ok', sources: data.sources, auto: data.auto, interval: data.interval, maxAgeMonths: data.max_age_months })
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
  const [addNote, setAddNote] = useState<Note | null>(null)
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
    setAddNote(null)
    try {
      const data = await addSource(name, url)
      applyList(setState, data)
      return true
    } catch (err) {
      if (err instanceof ServerError) {
        setAddNote(failure(err, 'Could not add site'))
      } else if (err instanceof OfflineError) {
        setState({ status: 'offline' })
      }
      return false
    }
  }, [])

  const change = useCallback(<A extends unknown[]>(call: (...a: A) => Promise<SourceListResponse>) =>
    async (...a: A): Promise<void> => {
      try {
        applyList(setState, await call(...a))
        retract('sources')
      } catch (err) {
        announce(failure(err), 'sources')
        setVersion((v) => v + 1)
      }
    }, [])
  const toggle = useMemo(() => change(patchSource), [change])
  const remove = useMemo(() => change(deleteSource), [change])
  const schedule = state.status === 'ok' ? state : null
  const updateSchedule = useCallback(
    async (auto: boolean, interval: string): Promise<void> => {
      if (schedule) await change(setSchedule)(auto, interval, schedule.maxAgeMonths)
    },
    [change, schedule],
  )

  const setAgeLimit = useCallback(
    async (maxAgeMonths: number | null): Promise<Note | null> => {
      if (!schedule) return null
      try {
        applyList(setState, await setSchedule(schedule.auto, schedule.interval, maxAgeMonths))
        return null
      } catch (err) {
        if (err instanceof ServerError) return failure(err)
        setVersion((v) => v + 1)
        return null
      }
    },
    [schedule],
  )

  return { state, add, toggle, remove, updateSchedule, setAgeLimit, addNote }
}
