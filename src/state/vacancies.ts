import { useCallback, useEffect, useRef, useState } from 'react'
import {
  DEFAULT_FILTERS,
  IndustryCount,
  LIST_WINDOW,
  LIST_WINDOW_MAX,
  listVacancies,
  OfflineError,
  ServerError,
  SourceCount,
  VacancyCounts,
  VacancyFilters,
  VacancyListResponse,
  VacancyRow,
  VacancyView,
} from '../api/client.ts'
import { failure, type Note, silent } from './messages.ts'

const NEVER_LOADED = Symbol()

const QUERY_KEY = 'sifty.inbox.query'
const FILTERS_KEY = 'sifty.inbox.filters'
const UNREAD_KEY = 'sifty.inbox.unread'
const SORT_KEY = 'sifty.inbox.sort'

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
    silent('the saved query is a convenience: the page works without it')()
  }
}

function loadSavedFilters(): VacancyFilters {
  try {
    const raw = localStorage.getItem(FILTERS_KEY)
    if (!raw) return DEFAULT_FILTERS
    const parsed = JSON.parse(raw) as Partial<VacancyFilters>
    return {
      published: (parsed.published === '7' || parsed.published === '30') ? parsed.published : '',
      remote: parsed.remote === true,
      leadership: parsed.leadership === true,
      industries: Array.isArray(parsed.industries) ? parsed.industries.filter((v): v is string => typeof v === 'string') : [],
      sources: Array.isArray(parsed.sources) ? parsed.sources.filter((v): v is string => typeof v === 'string') : [],
      fit: Array.isArray(parsed.fit) ? parsed.fit.filter((v): v is string => typeof v === 'string') : [],
    }
  } catch {
    return DEFAULT_FILTERS
  }
}

function saveFilters(f: VacancyFilters): void {
  try {
    const isDefault = !f.published && !f.remote && !f.leadership && f.industries.length === 0 && f.sources.length === 0 && f.fit.length === 0
    if (isDefault) {
      localStorage.removeItem(FILTERS_KEY)
    } else {
      localStorage.setItem(FILTERS_KEY, JSON.stringify(f))
    }
  } catch {
    silent('the saved filters is a convenience: the page works without it')()
  }
}

function loadSavedUnread(): boolean {
  try {
    return localStorage.getItem(UNREAD_KEY) === 'true'
  } catch {
    return false
  }
}

function saveUnread(v: boolean): void {
  try {
    if (v) {
      localStorage.setItem(UNREAD_KEY, 'true')
    } else {
      localStorage.removeItem(UNREAD_KEY)
    }
  } catch {
    silent('the saved Unread flag is a convenience: the page works without it')()
  }
}

function loadSavedSort(): 'fit' | 'newest' {
  try {
    return localStorage.getItem(SORT_KEY) === 'newest' ? 'newest' : 'fit'
  } catch {
    return 'fit'
  }
}

function saveSort(v: 'fit' | 'newest'): void {
  try {
    if (v !== 'fit') {
      localStorage.setItem(SORT_KEY, v)
    } else {
      localStorage.removeItem(SORT_KEY)
    }
  } catch {
    silent('the saved sort order is a convenience: the page works without it')()
  }
}

const CHECK_POLL_MS = 2000

export function useCheckRefresh(view: VacancyView | null, reload: (id: number) => Promise<void>): void {
  const active = view?.check?.active === true
  const id = view?.id
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (!active || id === undefined) return
    const timer = setTimeout(() => {
      void reload(id).finally(() => setTick((n) => n + 1))
    }, CHECK_POLL_MS)
    return () => clearTimeout(timer)
  }, [active, id, tick, reload])
}

export type VacancyListState =
  | { status: 'loading' }
  | { status: 'offline' }
  | { status: 'error'; message: string }
  | {
      status: 'ok'
      rows: VacancyRow[]
      counts: VacancyCounts
      profile: number
      empty: string
      total: number
      matching: number
      industryCounts: IndustryCount[]
      sourceCounts: SourceCount[]
    }

export interface UseVacanciesResult {
  state: VacancyListState
  query: string
  setQuery: (q: string) => void
  filters: VacancyFilters
  setFilters: (f: VacancyFilters) => void
  unread: boolean
  setUnread: (v: boolean) => void
  sort: 'fit' | 'newest'
  setSort: (v: 'fit' | 'newest') => void
  resetAll: () => void
  loadMore: (gone: ReadonlySet<number>) => void
  loadingMore: boolean
  moreError: Note | null
}

function mergeRows(held: VacancyRow[], more: VacancyRow[]): VacancyRow[] {
  const ids = new Set(held.map((r) => r.id))
  return [...held, ...more.filter((r) => !ids.has(r.id))]
}

async function fetchSpan(
  span: number,
  fetchWindow: (limit: number, offset: number) => Promise<VacancyListResponse>,
): Promise<VacancyListResponse> {
  let data = await fetchWindow(Math.min(span, LIST_WINDOW_MAX), 0)
  let rows = data.rows
  while (rows.length < span && rows.length < data.matching) {
    const next = await fetchWindow(Math.min(span - rows.length, LIST_WINDOW_MAX), rows.length)
    if (next.rows.length === 0) break
    rows = mergeRows(rows, next.rows)
    data = next
  }
  return { ...data, rows }
}

export function useVacancies(stage: string, reloadTrigger = 0, profile: number | null = null): UseVacanciesResult {
  const [query, setQueryState] = useState<string>(loadSavedQuery)
  const [pending, setPending] = useState<string>(loadSavedQuery)
  const [filters, setFiltersState] = useState<VacancyFilters>(loadSavedFilters)
  const [unread, setUnreadState] = useState<boolean>(loadSavedUnread)
  const [sort, setSortState] = useState<'fit' | 'newest'>(loadSavedSort)
  const [state, setState] = useState<VacancyListState>({ status: 'loading' })
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prevQueryRef = useRef<string | typeof NEVER_LOADED>(NEVER_LOADED)
  const prevSelectionRef = useRef('')
  const heldRef = useRef<VacancyRow[]>([])
  const generationRef = useRef(0)
  const loadingMoreRef = useRef(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [moreError, setMoreError] = useState<Note | null>(null)

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

  const setFilters = useCallback((f: VacancyFilters) => {
    setFiltersState(f)
    saveFilters(f)
  }, [])

  const setUnread = useCallback((v: boolean) => {
    setUnreadState(v)
    saveUnread(v)
  }, [])

  const setSort = useCallback((v: 'fit' | 'newest') => {
    setSortState(v)
    saveSort(v)
  }, [])

  const resetAll = useCallback(() => {
    if (debounceRef.current !== null) {
      clearTimeout(debounceRef.current)
    }
    setPending('')
    setQueryState('')
    saveQuery('')
    setFiltersState(DEFAULT_FILTERS)
    saveFilters(DEFAULT_FILTERS)
    setUnreadState(false)
    saveUnread(false)
    setSortState('fit')
    saveSort('fit')
  }, [])

  useEffect(() => {
    let cancelled = false
    generationRef.current += 1
    loadingMoreRef.current = false
    setLoadingMore(false)
    setMoreError(null)
    if (prevQueryRef.current === NEVER_LOADED || prevQueryRef.current !== query) {
      setState({ status: 'loading' })
    }
    prevQueryRef.current = query

    const selection = JSON.stringify([stage, query, filters, unread, profile, sort])
    const span = prevSelectionRef.current === selection ? Math.max(LIST_WINDOW, heldRef.current.length) : LIST_WINDOW
    prevSelectionRef.current = selection

    fetchSpan(span, (limit, offset) => listVacancies(profile, stage, query, filters, unread, sort, limit, offset))
      .then((data) => {
        if (!cancelled) {
          heldRef.current = data.rows
          setState({
            status: 'ok',
            rows: data.rows,
            counts: data.counts,
            profile: data.profile,
            empty: data.empty,
            total: data.total,
            matching: data.matching,
            industryCounts: data.industryCounts,
            sourceCounts: data.sourceCounts,
          })
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          heldRef.current = []
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
  }, [stage, query, filters, unread, reloadTrigger, profile, sort])

  const loadMore = useCallback(
    (gone: ReadonlySet<number>) => {
      if (loadingMoreRef.current) return
      const held = heldRef.current
      const offset = held.filter((r) => !gone.has(r.id)).length
      const generation = generationRef.current
      loadingMoreRef.current = true
      setLoadingMore(true)
      setMoreError(null)
      listVacancies(profile, stage, query, filters, unread, sort, LIST_WINDOW, offset)
        .then((data) => {
          if (generation !== generationRef.current) return
          setState((prev) => {
            if (prev.status !== 'ok') return prev
            const rows = mergeRows(prev.rows.filter((r) => !gone.has(r.id)), data.rows)
            heldRef.current = rows
            return {
              status: 'ok',
              rows,
              counts: data.counts,
              profile: data.profile,
              empty: data.empty,
              total: data.total,
              matching: data.matching,
              industryCounts: data.industryCounts,
              sourceCounts: data.sourceCounts,
            }
          })
        })
        .catch((err: unknown) => {
          if (generation !== generationRef.current) return
          setMoreError(failure(err instanceof OfflineError ? 'Server unreachable' : err, 'Could not load more roles'))
        })
        .finally(() => {
          if (generation !== generationRef.current) return
          loadingMoreRef.current = false
          setLoadingMore(false)
        })
    },
    [stage, query, filters, unread, sort, profile],
  )

  return {
    state, query: pending, setQuery, filters, setFilters, unread, setUnread, sort, setSort, resetAll,
    loadMore, loadingMore, moreError,
  }
}
