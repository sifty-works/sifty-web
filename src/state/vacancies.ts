import { useCallback, useEffect, useRef, useState } from 'react'
import {
  listVacancies,
  OfflineError,
  ServerError,
  VacancyCounts,
  VacancyRow,
} from '../api/client.ts'

const NEVER_LOADED = Symbol()

const QUERY_KEY = 'sifty.inbox.query'

function loadSavedQuery(): string {
  try {
    return localStorage.getItem(QUERY_KEY) ?? ''
  } catch {
    return ''
  }
}

function saveQuery(q: string): void {
  try {
    if (q) {
      localStorage.setItem(QUERY_KEY, q)
    } else {
      localStorage.removeItem(QUERY_KEY)
    }
  } catch {
    // storage unavailable — ignore
  }
}

export type VacancyListState =
  | { status: 'loading' }
  | { status: 'offline' }
  | { status: 'error'; message: string }
  | { status: 'ok'; rows: VacancyRow[]; counts: VacancyCounts; profile: number; empty: string }

export interface UseVacanciesResult {
  state: VacancyListState
  query: string
  setQuery: (q: string) => void
  resetQuery: () => void
}

export function useVacancies(stage: string, reloadTrigger = 0): UseVacanciesResult {
  const [query, setQueryState] = useState<string>(loadSavedQuery)
  const [pending, setPending] = useState<string>(loadSavedQuery)
  const [state, setState] = useState<VacancyListState>({ status: 'loading' })
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prevQueryRef = useRef<string | typeof NEVER_LOADED>(NEVER_LOADED)

  const setQuery = useCallback((q: string) => {
    setPending(q)
    if (debounceRef.current !== null) {
      clearTimeout(debounceRef.current)
    }
    debounceRef.current = setTimeout(() => {
      setQueryState(q)
      saveQuery(q)
    }, 250)
  }, [])

  const resetQuery = useCallback(() => {
    if (debounceRef.current !== null) {
      clearTimeout(debounceRef.current)
    }
    setPending('')
    setQueryState('')
    saveQuery('')
  }, [])

  useEffect(() => {
    let cancelled = false
    if (prevQueryRef.current === NEVER_LOADED || prevQueryRef.current !== query) {
      setState({ status: 'loading' })
    }
    prevQueryRef.current = query

    listVacancies(null, stage, query)
      .then((data) => {
        if (!cancelled) {
          setState({
            status: 'ok',
            rows: data.rows,
            counts: data.counts,
            profile: data.profile,
            empty: data.empty,
          })
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          if (err instanceof OfflineError) {
            setState({ status: 'offline' })
          } else if (err instanceof ServerError) {
            setState({ status: 'error', message: err.message })
          } else {
            setState({ status: 'offline' })
          }
        }
      })

    return () => {
      cancelled = true
    }
  }, [stage, query, reloadTrigger])

  return { state, query: pending, setQuery, resetQuery }
}
