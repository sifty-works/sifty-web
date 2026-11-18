import { useCallback, useEffect, useRef, useState } from 'react'
import {
  addExclusion,
  getVacancy,
  markSeen,
  OfflineError,
  VacancyCounts,
  VacancyView,
} from '../api/client.ts'
import { installNavShortcuts } from '../keyboard.ts'
import { useVacancies } from '../state/vacancies.ts'
import { OfflineNotice } from './OfflineNotice.tsx'
import { SearchField } from './SearchField.tsx'
import { VacancyPage } from './VacancyPage.tsx'
import { VacancyRow } from './VacancyRow.tsx'

const LIST_WIDTH_KEY = 'sifty.list.width'
const LIST_WIDTH_DEFAULT = 320
const LIST_WIDTH_MIN = 200
const LIST_WIDTH_MAX = 600

function loadListWidth(): number {
  try {
    const v = localStorage.getItem(LIST_WIDTH_KEY)
    if (v !== null) {
      const n = parseInt(v, 10)
      if (!isNaN(n) && n >= LIST_WIDTH_MIN && n <= LIST_WIDTH_MAX) return n
    }
  } catch {
    // storage unavailable — use default
  }
  return LIST_WIDTH_DEFAULT
}

function saveListWidth(w: number): void {
  try {
    localStorage.setItem(LIST_WIDTH_KEY, String(w))
  } catch {
    // storage unavailable — ignore
  }
}

interface Props {
  stage: string
  reloadTrigger?: number
  onCounts?: (counts: VacancyCounts) => void
}

export function InboxList({ stage, reloadTrigger, onCounts }: Props) {
  const [blockCount, setBlockCount] = useState(0)
  const { state, query, setQuery, resetQuery } = useVacancies(
    stage,
    (reloadTrigger ?? 0) + blockCount,
  )

  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [seenInSession, setSeenInSession] = useState<ReadonlySet<number>>(new Set())
  const [pageView, setPageView] = useState<VacancyView | null>(null)
  const [pageError, setPageError] = useState<string | null>(null)
  const [listWidth, setListWidth] = useState<number>(loadListWidth)
  const dragRef = useRef<{ startX: number; startW: number } | null>(null)

  const profile = state.status === 'ok' ? state.profile : null
  const rows = state.status === 'ok' ? state.rows : []
  const counts = state.status === 'ok' ? state.counts : null
  const empty = state.status === 'ok' ? state.empty : ''
  const loading = state.status === 'loading'
  const total = counts ? (counts[stage as keyof VacancyCounts] ?? rows.length) : 0

  useEffect(() => {
    if (state.status === 'ok') {
      onCounts?.(state.counts)
    }
  }, [state, onCounts])

  const selectRow = useCallback(
    (id: number) => {
      setSelectedId(id)
      setPageView(null)
      setPageError(null)
      const row = rows.find((r) => r.id === id)
      const isUnread = row ? row.unread && !seenInSession.has(id) : false
      if (isUnread) {
        setSeenInSession((prev) => new Set([...prev, id]))
        void markSeen(id).catch(() => {})
      }
      void getVacancy(id, profile)
        .then((v) => setPageView(v))
        .catch((err: unknown) => {
          const msg =
            err instanceof OfflineError
              ? 'Server unreachable'
              : err instanceof Error
                ? err.message
                : 'Could not load vacancy'
          setPageError(msg)
        })
    },
    [rows, seenInSession, profile],
  )

  useEffect(() => {
    const selectNext = () => {
      if (rows.length === 0) return
      const idx = rows.findIndex((r) => r.id === selectedId)
      const next = idx === -1 ? 0 : (idx + 1) % rows.length
      selectRow(rows[next].id)
    }
    const selectPrev = () => {
      if (rows.length === 0) return
      const idx = rows.findIndex((r) => r.id === selectedId)
      const prev = idx <= 0 ? rows.length - 1 : idx - 1
      selectRow(rows[prev].id)
    }
    return installNavShortcuts(selectPrev, selectNext)
  }, [rows, selectedId, selectRow])

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!dragRef.current) return
      const w = Math.max(
        LIST_WIDTH_MIN,
        Math.min(LIST_WIDTH_MAX, dragRef.current.startW + e.clientX - dragRef.current.startX),
      )
      setListWidth(w)
      saveListWidth(w)
    }
    function onMouseUp() {
      dragRef.current = null
    }
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
    return () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
  }, [])

  function onDividerMouseDown(e: React.MouseEvent) {
    dragRef.current = { startX: e.clientX, startW: listWidth }
    e.preventDefault()
  }

  function onDividerDblClick() {
    setListWidth(LIST_WIDTH_DEFAULT)
    saveListWidth(LIST_WIDTH_DEFAULT)
  }

  async function handleAction(key: string, url?: string) {
    if (key === 'block' && pageView) {
      await addExclusion('company', pageView.company)
      setBlockCount((n) => n + 1)
      setSelectedId(null)
      setPageView(null)
    } else if (key === 'apply' && url) {
      window.open(url, '_blank', 'noopener')
    }
  }

  if (state.status === 'offline') {
    return <OfflineNotice />
  }

  if (state.status === 'error') {
    return (
      <div className="list-area list-area--center">
        <p className="list-message">{state.message}</p>
      </div>
    )
  }

  return (
    <div className="inbox-split">
      <div className="inbox-list-pane" style={{ width: listWidth }}>
        <div className="list-toolbar">
          <SearchField value={query} onChange={setQuery} />
        </div>

        <div className="list-scroll">
          {loading ? null : rows.length === 0 ? (
            <div className="list-empty">
              <p className="list-message">{empty}</p>
              {query.trim() !== '' && (
                <button className="btn-reset" onClick={resetQuery}>
                  Reset filters
                </button>
              )}
            </div>
          ) : (
            rows.map((row) => (
              <VacancyRow
                key={row.id}
                row={{ ...row, unread: row.unread && !seenInSession.has(row.id) }}
                selected={row.id === selectedId}
                onSelect={() => selectRow(row.id)}
              />
            ))
          )}
        </div>

        {!loading && (
          <div className="list-footer">
            Showing {rows.length} / {total} roles
          </div>
        )}
      </div>

      <div
        className="inbox-divider"
        onMouseDown={onDividerMouseDown}
        onDoubleClick={onDividerDblClick}
        role="separator"
        aria-label="Resize list"
      />

      <div className="inbox-page-pane">
        {pageError ? (
          <div className="list-area--center" style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
            <p className="list-message">{pageError}</p>
          </div>
        ) : pageView ? (
          <VacancyPage
            view={pageView}
            onAction={(key, url) => void handleAction(key, url)}
          />
        ) : (
          <div className="inbox-page-empty" />
        )}
      </div>
    </div>
  )
}
