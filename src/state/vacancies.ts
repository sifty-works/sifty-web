import { useCallback, useEffect, useRef, useState } from 'react'
import { listVacancies, OfflineError, ServerError, VacancyRow } from '../api/client.ts'

// Sentinel so the first call always shows the loading state.
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
  | { status: 'ok'; rows: VacancyRow[]; total: number; empty: string }

export interface UseVacanciesResult {
  state: VacancyListState
  query: string
  setQuery: (q: string) => void
  resetQuery: () => void
}

export function useVacancies(reloadTrigger = 0): UseVacanciesResult {
  const [query, setQueryState] = useState<string>(loadSavedQuery)
  const [pending, setPending] = useState<string>(loadSavedQuery)
  const [state, setState] = useState<VacancyListState>({ status: 'loading' })
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Track the last query that triggered a full loading state so a catalogue
  // reload (same query, new reloadTrigger) keeps current rows on screen.
  const prevQueryRef = useRef<string | typeof NEVER_LOADED>(NEVER_LOADED)

  // Debounced setter: updates pending immediately, fires query after 250 ms.
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
    // Show the loading state on the first fetch or when the query changes.
    // A catalogue-triggered reload (same query) keeps the current rows visible
    // so the scroll position is preserved and there is no flicker.
    if (prevQueryRef.current === NEVER_LOADED || prevQueryRef.current !== query) {
      setState({ status: 'loading' })
    }
    prevQueryRef.current = query

    listVacancies(query)
      .then((data) => {
        if (!cancelled) {
          setState({ status: 'ok', rows: data.rows, total: data.counts['inbox'] ?? 0, empty: data.empty })
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
  }, [query, reloadTrigger])

  // Expose the pending value as the visible query so the field updates instantly.
  return { state, query: pending, setQuery, resetQuery }
}
