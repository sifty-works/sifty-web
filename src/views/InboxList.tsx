import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  addExclusion,
  deleteVacancy,
  getVacancy,
  markSeen,
  OfflineError,
  postDecision,
  ServerError,
  VacancyCounts,
  VacancyRow as VacancyRowData,
  VacancyView,
} from '../api/client.ts'
import { installActionShortcuts, installNavShortcuts } from '../keyboard.ts'
import { SessionDecision } from '../state/decisions.ts'
import { useVacancies } from '../state/vacancies.ts'
import { ApplyOutcome, ApplyOutcomeDialog, DeleteConfirmDialog } from './Dialogs.tsx'
import { OfflineNotice } from './OfflineNotice.tsx'
import { SearchField } from './SearchField.tsx'
import { VacancyPage } from './VacancyPage.tsx'
import { VacancyRow } from './VacancyRow.tsx'

const LIST_WIDTH_KEY = 'sifty.list.width'
const LIST_WIDTH_DEFAULT = 320
const LIST_WIDTH_MIN = 200
const LIST_WIDTH_MAX = 600

type ActiveDialog =
  | { kind: 'none' }
  | { kind: 'apply'; note: string | null }
  | { kind: 'delete' }

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

/** Returns the id of the next undecided row after currentId, wrapping around. */
function findNextUndecided(
  currentId: number,
  list: VacancyRowData[],
  decisions: Map<number, SessionDecision>,
): number | null {
  if (list.length === 0) return null
  const idx = list.findIndex((r) => r.id === currentId)
  if (idx === -1) return null
  for (let i = idx + 1; i < list.length; i++) {
    if (!decisions.has(list[i].id)) return list[i].id
  }
  for (let i = 0; i < idx; i++) {
    if (!decisions.has(list[i].id)) return list[i].id
  }
  return null
}

interface Props {
  stage: string
  reloadTrigger?: number
  onCounts?: (counts: VacancyCounts) => void
  /** True when Settings is open — prevents keyboard shortcuts from firing. */
  settingsOpen?: boolean
}

export function InboxList({ stage, reloadTrigger, onCounts, settingsOpen }: Props) {
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
  const [sessionDecisions, setSessionDecisions] = useState<Map<number, SessionDecision>>(new Map())
  const [actionError, setActionError] = useState<string | null>(null)
  const [activeDialog, setActiveDialog] = useState<ActiveDialog>({ kind: 'none' })
  const [applyDialogSaving, setApplyDialogSaving] = useState(false)
  const [applyDialogError, setApplyDialogError] = useState<string | null>(null)
  const [deleteDialogSaving, setDeleteDialogSaving] = useState(false)
  const [deleteDialogError, setDeleteDialogError] = useState<string | null>(null)
  const dragRef = useRef<{ startX: number; startW: number } | null>(null)

  const dialogOpen = activeDialog.kind !== 'none'
  const profile = state.status === 'ok' ? state.profile : null
  const rows = state.status === 'ok' ? state.rows : []
  const counts = state.status === 'ok' ? state.counts : null
  const empty = state.status === 'ok' ? state.empty : ''
  const loading = state.status === 'loading'
  const total = counts ? (counts[stage as keyof VacancyCounts] ?? rows.length) : 0

  // Inject session-decided rows back into the inbox list so they stay visible until reload.
  const displayRows = useMemo<VacancyRowData[]>(() => {
    if (stage !== 'inbox') return rows
    const serverIds = new Set(rows.map((r) => r.id))
    const decided = Array.from(sessionDecisions.values()).sort((a, b) => a.idx - b.idx)
    const result: VacancyRowData[] = [...rows]
    for (const dec of decided) {
      if (!serverIds.has(dec.row.id)) {
        const pos = Math.min(dec.idx, result.length)
        result.splice(pos, 0, dec.row)
      }
    }
    return result
  }, [rows, sessionDecisions, stage])

  const dismissedThisSession = useMemo(
    () => Array.from(sessionDecisions.values()).filter((d) => d.to === 'dismissed').length,
    [sessionDecisions],
  )

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
      setActionError(null)
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

  // handleAction is defined as a plain function; we keep a ref so the keyboard
  // effects always call the latest version without stale closures.
  const handleActionRef = useRef<(key: string, url?: string, message?: string) => void>(() => {})

  async function handleAction(key: string, url?: string, _message?: string) {
    if (!pageView || profile === null) return
    setActionError(null)

    if (key === 'block') {
      try {
        await addExclusion('company', pageView.company)
        setBlockCount((n) => n + 1)
        setSelectedId(null)
        setPageView(null)
      } catch (err) {
        setActionError(err instanceof ServerError ? err.message : 'Could not block company')
      }
      return
    }

    if (key === 'apply' || key === 'confirm') {
      // Apply opens the employer URL in a new window, then shows the outcome dialog.
      let note: string | null = null
      if (!url) {
        note = _message ?? 'No valid employer or original listing URL is available. The role stays in Shortlist.'
      } else {
        const opened = window.open(url, '_blank', 'noopener')
        if (!opened) {
          note = 'The application page was blocked. Allow popups and try Apply again. The role stays in Shortlist.'
        }
      }
      setApplyDialogSaving(false)
      setApplyDialogError(null)
      setActiveDialog({ kind: 'apply', note })
      return
    }

    if (key === 'delete') {
      setDeleteDialogSaving(false)
      setDeleteDialogError(null)
      setActiveDialog({ kind: 'delete' })
      return
    }

    // Decision actions
    let from: string
    let to: string
    if (key === 'select') { from = 'inbox'; to = 'shortlist' }
    else if (key === 'dismiss') { from = 'inbox'; to = 'dismissed' }
    else if (key === 'undo' || key === 'inbox') { from = pageView.stage; to = 'inbox' }
    else if (key === 'restore') { from = 'dismissed'; to = 'inbox' }
    else { return }

    try {
      const { counts: newCounts } = await postDecision(pageView.id, { profile, from, to })
      onCounts?.(newCounts)

      if (key === 'select' || key === 'dismiss') {
        // Keep row in inbox list with decided badge; move to next undecided row.
        const originalRow = rows.find((r) => r.id === pageView.id) ?? {
          id: pageView.id,
          company: pageView.company,
          title: pageView.title,
          location: pageView.location,
          published: pageView.published,
          unread: pageView.unread,
          stage: pageView.stage,
          reason: pageView.reason,
          applied: pageView.applied,
          expired: pageView.expired,
        }
        const idx = displayRows.findIndex((r) => r.id === pageView.id)
        const newDecision: SessionDecision = {
          row: originalRow,
          from,
          to,
          idx: idx >= 0 ? idx : displayRows.length,
        }
        const nextDecisions = new Map(sessionDecisions)
        nextDecisions.set(pageView.id, newDecision)
        setSessionDecisions(nextDecisions)
        const nextId = findNextUndecided(pageView.id, displayRows, nextDecisions)
        if (nextId !== null) {
          selectRow(nextId)
        } else {
          setSelectedId(null)
          setPageView(null)
        }
      } else {
        // undo / inbox / restore: row returns to inbox; reload the list.
        setSessionDecisions((prev) => {
          const next = new Map(prev)
          next.delete(pageView.id)
          return next
        })
        setBlockCount((n) => n + 1)
        setSelectedId(null)
        setPageView(null)
      }
    } catch (err) {
      setActionError(err instanceof ServerError ? err.message : 'Could not save decision')
    }
  }

  async function handleApplyOutcome(outcome: ApplyOutcome) {
    if (!pageView || profile === null) return
    if (outcome.kind === 'not_yet') {
      setActiveDialog({ kind: 'none' })
      return
    }
    setApplyDialogSaving(true)
    setApplyDialogError(null)
    try {
      if (outcome.kind === 'applied') {
        const { counts: newCounts } = await postDecision(pageView.id, {
          profile,
          from: pageView.stage,
          to: 'applied',
          confirmed: true,
        })
        onCounts?.(newCounts)
      } else {
        const { counts: newCounts } = await postDecision(pageView.id, {
          profile,
          from: pageView.stage,
          to: 'dismissed',
          reason: outcome.reason,
        })
        onCounts?.(newCounts)
      }
      setActiveDialog({ kind: 'none' })
      setBlockCount((n) => n + 1)
      setSelectedId(null)
      setPageView(null)
    } catch (err) {
      setApplyDialogSaving(false)
      setApplyDialogError(err instanceof ServerError ? err.message : 'Could not save outcome')
    }
  }

  async function handleDeleteConfirm() {
    if (!pageView || profile === null) return
    setDeleteDialogSaving(true)
    setDeleteDialogError(null)
    try {
      const { counts: newCounts } = await deleteVacancy(pageView.id, profile)
      onCounts?.(newCounts)
      setActiveDialog({ kind: 'none' })
      // Move to the next available row.
      const idx = displayRows.findIndex((r) => r.id === pageView.id)
      const nextRow =
        displayRows.find((_, i) => i > idx) ??
        displayRows.find((_, i) => i < idx) ??
        null
      setBlockCount((n) => n + 1)
      if (nextRow) {
        selectRow(nextRow.id)
      } else {
        setSelectedId(null)
        setPageView(null)
      }
    } catch (err) {
      setDeleteDialogSaving(false)
      setDeleteDialogError(err instanceof ServerError ? err.message : 'Could not delete role')
    }
  }

  // Keep ref current on every render.
  handleActionRef.current = (key, url, message) => void handleAction(key, url, message)

  // Nav shortcuts: J/K and ↓/↑, blocked while a dialog is open.
  useEffect(() => {
    const selectNext = () => {
      if (dialogOpen || displayRows.length === 0) return
      const idx = displayRows.findIndex((r) => r.id === selectedId)
      const next = idx === -1 ? 0 : (idx + 1) % displayRows.length
      selectRow(displayRows[next].id)
    }
    const selectPrev = () => {
      if (dialogOpen || displayRows.length === 0) return
      const idx = displayRows.findIndex((r) => r.id === selectedId)
      const prev = idx <= 0 ? displayRows.length - 1 : idx - 1
      selectRow(displayRows[prev].id)
    }
    return installNavShortcuts(selectPrev, selectNext)
  }, [displayRows, selectedId, selectRow, dialogOpen])

  // Action shortcuts: Y selects (inbox), N dismisses (inbox), A applies (shortlist).
  useEffect(() => {
    return installActionShortcuts(
      () => {
        if (stage === 'inbox' && selectedId !== null)
          handleActionRef.current('select')
      },
      () => {
        if (stage === 'inbox' && selectedId !== null)
          handleActionRef.current('dismiss')
      },
      () => {
        if (stage === 'shortlist' && selectedId !== null && pageView) {
          const a = pageView.actions.find((x) => x.key === 'apply')
          if (a) handleActionRef.current('apply', a.url, a.message)
        }
      },
      () => dialogOpen || (settingsOpen ?? false),
    )
  }, [stage, selectedId, pageView, dialogOpen, settingsOpen])

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
          {loading ? null : displayRows.length === 0 ? (
            <div className="list-empty">
              <p className="list-message">{empty}</p>
              {query.trim() !== '' && (
                <button className="btn-reset" onClick={resetQuery}>
                  Reset filters
                </button>
              )}
            </div>
          ) : (
            displayRows.map((row) => (
              <VacancyRow
                key={row.id}
                row={{ ...row, unread: row.unread && !seenInSession.has(row.id) }}
                selected={row.id === selectedId}
                onSelect={() => selectRow(row.id)}
                decidedTo={sessionDecisions.get(row.id)?.to ?? null}
              />
            ))
          )}
        </div>

        {!loading && (
          <div className="list-footer">
            <span>Showing {displayRows.length} / {total} roles</span>
            {dismissedThisSession > 0 && (
              <span className="list-footer__notice">
                {dismissedThisSession} dismissed this session — they disappear next time.
              </span>
            )}
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
            sessionDecision={sessionDecisions.get(pageView.id) ?? null}
            actionError={actionError}
            onAction={(key, url, message) => void handleAction(key, url, message)}
          />
        ) : (
          <div className="inbox-page-empty" />
        )}
      </div>

      {activeDialog.kind === 'apply' && (
        <ApplyOutcomeDialog
          note={activeDialog.note}
          saving={applyDialogSaving}
          error={applyDialogError}
          onDecide={(outcome) => void handleApplyOutcome(outcome)}
        />
      )}
      {activeDialog.kind === 'delete' && (
        <DeleteConfirmDialog
          saving={deleteDialogSaving}
          error={deleteDialogError}
          onKeep={() => setActiveDialog({ kind: 'none' })}
          onDelete={() => void handleDeleteConfirm()}
        />
      )}
    </div>
  )
}
