import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  addExclusion,
  deleteVacancy,
  FitMark,
  getVacancy,
  listSources,
  markSeen,
  OfflineError,
  Outcome,
  postDecision,
  postLocate,
  postShortlistCheckRetry,
  postSkillsDecision,
  ServerError,
  SkillAnswer,
  VacancyCounts,
  VacancyRow as VacancyRowData,
  VacancyView,
} from '../api/client.ts'
import { installActionShortcuts, installNavShortcuts } from '../keyboard.ts'
import { ReturnedRow, SessionDecision } from '../state/decisions.ts'
import { announce, failure, retract, type Note, silent } from '../state/messages.ts'
import { useViewRefresh, useVacancies } from '../state/vacancies.ts'
import { ApplyOutcomeDialog, DeleteConfirmDialog } from './Dialogs.tsx'
import { FilterPanel } from './FilterPanel.tsx'
import { Icon } from './Icon.tsx'
import { ListResizer, useListWidth } from './ListResizer.tsx'
import { Refusal } from './Refusal.tsx'
import { SearchField } from './SearchField.tsx'
import { ACTIONS, VacancyPage } from './VacancyPage.tsx'
import { VacancyRow } from './VacancyRow.tsx'

const SERVER_DOWN = 'Sifty server is not responding. Retrying…'
const SERVER_DOWN_NOTE: Note = { kind: 'failure', text: SERVER_DOWN }

type ActiveDialog =
  | { kind: 'none' }
  | { kind: 'apply'; title: string; company: string; note: string | null; outcomes: Outcome[] }
  | { kind: 'delete'; title: string; company: string }

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
  settingsOpen?: boolean
  mainTab?: string
  archiveTab?: string
  onArchiveTab?: (tab: string) => void
  profile?: number | null
}

export function InboxList({
  stage,
  reloadTrigger,
  onCounts,
  settingsOpen,
  mainTab,
  archiveTab,
  onArchiveTab,
  profile: profileProp,
}: Props) {
  const [blockCount, setBlockCount] = useState(0)
  const {
    state, query, setQuery, filters, setFilters, unread, setUnread, sort, setSort, resetAll, loadMore, loadingMore,
  } = useVacancies(
    stage,
    (reloadTrigger ?? 0) + blockCount,
    profileProp ?? null,
  )

  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [seenInSession, setSeenInSession] = useState<ReadonlySet<number>>(new Set())
  const [panelOpen, setPanelOpen] = useState(false)
  const [allSources, setAllSources] = useState<{ key: string; name: string }[]>([])

  const heldRowDataRef = useRef<VacancyRowData | null>(null)
  const [heldRowId, setHeldRowId] = useState<number | null>(null)
  const [pageView, setPageView] = useState<VacancyView | null>(null)
  const [pageError, setPageError] = useState<Note | null>(null)
  const [listWidth, setListWidth] = useListWidth()
  const [sessionDecisions, setSessionDecisions] = useState<Map<number, SessionDecision>>(new Map())
  const [returnedRows, setReturnedRows] = useState<Map<number, ReturnedRow>>(new Map())
  const [rowFitUpdates, setRowFitUpdates] = useState<Map<number, FitMark>>(new Map())
  const [activeDialog, setActiveDialog] = useState<ActiveDialog>({ kind: 'none' })
  const [applyDialogSaving, setApplyDialogSaving] = useState(false)
  const [applyDialogNote, setApplyDialogNote] = useState<Note | null>(null)
  const [deleteDialogSaving, setDeleteDialogSaving] = useState(false)
  const [deleteDialogNote, setDeleteDialogNote] = useState<Note | null>(null)

  const dialogOpen = activeDialog.kind !== 'none'
  const profile = state.status === 'ok' ? state.profile : null
  const rows = useMemo(() => (state.status === 'ok' ? state.rows : []), [state])
  const counts = state.status === 'ok' ? state.counts : null
  const empty = state.status === 'ok' ? state.empty : ''
  const total = state.status === 'ok' ? state.total : 0
  const matching = state.status === 'ok' ? state.matching : 0
  const hasMore = rows.length < matching
  const sourceCounts = state.status === 'ok' ? state.sourceCounts : []
  const loading = state.status === 'loading'
  const listNote = useMemo<Note | null>(
    () => (state.status === 'offline' ? SERVER_DOWN_NOTE : state.status === 'error' ? failure(state.message) : null),
    [state],
  )

  const activeFilterCount = [
    filters.published !== '',
    filters.remote,
    filters.leadership,
    ...filters.sources.map(() => true),
    ...filters.fit.map(() => true),
  ].filter(Boolean).length

  useEffect(() => {
    void listSources().then((resp) => {
      setAllSources(resp.sources.map((s) => ({ key: s.key, name: s.name })))
    }).catch(silent('the source filter list is optional: the filter stays empty'))
  }, [])

  useEffect(() => {
    setReturnedRows(new Map())
  }, [stage, query, filters, unread, sort, profileProp, reloadTrigger, blockCount])

  useEffect(() => {
    if (!unread) {
      heldRowDataRef.current = null
      setHeldRowId(null)
    }
  }, [unread])

  const displayRows = useMemo<VacancyRowData[]>(() => {
    const serverIds = new Set(rows.map((r) => r.id))
    const result: VacancyRowData[] = [...rows]
    if (stage === 'inbox') {
      const placed = new Map<number, ReturnedRow>(returnedRows)
      for (const [id, dec] of sessionDecisions) placed.set(id, dec)
      const ordered = Array.from(placed.values()).sort((a, b) => a.idx - b.idx)
      for (const item of ordered) {
        if (!serverIds.has(item.row.id)) {
          const pos = Math.min(item.idx, result.length)
          result.splice(pos, 0, item.row)
        }
      }
    }

    if (unread && heldRowId !== null && heldRowDataRef.current !== null && !serverIds.has(heldRowId)) {
      result.push(heldRowDataRef.current)
    }
    return result
  }, [rows, sessionDecisions, returnedRows, stage, unread, heldRowId])

  const gone = useMemo<ReadonlySet<number>>(() => {
    const ids = new Set<number>()
    if (stage === 'inbox') for (const id of sessionDecisions.keys()) ids.add(id)
    if (unread) for (const id of seenInSession) ids.add(id)
    return ids
  }, [sessionDecisions, seenInSession, stage, unread])

  const dismissedThisSession = useMemo(
    () => Array.from(sessionDecisions.values()).filter((d) => d.to === 'dismissed').length,
    [sessionDecisions],
  )

  useEffect(() => {
    if (counts !== null) onCounts?.(counts)
  }, [counts, onCounts])

  const selectedIdRef = useRef<number | null>(null)
  selectedIdRef.current = selectedId

  const openRow = useCallback(
    (id: number) => {
      selectedIdRef.current = id
      setSelectedId(id)
      setPageView(null)
      setPageError(null)
      retract('vacancy-action')
      void getVacancy(id, profile)
        .then((v) => {
          if (selectedIdRef.current === id) setPageView(v)
        })
        .catch((err: unknown) => {
          if (selectedIdRef.current !== id) return
          setPageError(failure(err instanceof OfflineError ? 'Server unreachable' : err, 'Could not load vacancy'))
        })
    },
    [profile],
  )

  const reloadOpen = useCallback(
    async (id: number) => {
      try {
        const v = await getVacancy(id, profile)
        setPageView((cur) => (cur?.id === id ? v : cur))
      } catch {
        silent('the refresh retries on the next visit: the open page keeps what it shows')()
      }
    },
    [profile],
  )
  useViewRefresh(pageView, reloadOpen)

  const selectRow = useCallback(
    (id: number) => {
      const row = rows.find((r) => r.id === id)
      const isUnread = row ? row.unread && !seenInSession.has(id) : false
      if (isUnread) {
        setSeenInSession((prev) => new Set([...prev, id]))
        void markSeen(id).catch(silent('the read mark is bookkeeping: the role stays unread until the next visit'))
      }

      if (unread) {
        const rowData = row ?? (heldRowDataRef.current?.id === id ? heldRowDataRef.current : null)
        heldRowDataRef.current = rowData
        setHeldRowId(id)
      }
      openRow(id)
    },
    [rows, seenInSession, unread, openRow],
  )

  const goneRef = useRef<ReadonlySet<number>>(new Set())

  useEffect(() => {
    goneRef.current = new Set()
  }, [rows])

  useEffect(() => {
    if (loading || listNote) return
    if (selectedId !== null && displayRows.some((r) => r.id === selectedId)) return
    const first = displayRows.find((r) => !goneRef.current.has(r.id))
    if (first) {
      openRow(first.id)
    } else if (selectedId !== null && displayRows.length === 0) {
      setSelectedId(null)
      setPageView(null)
    }
  }, [loading, listNote, selectedId, displayRows, openRow])

  const selectAfterRemoval = useCallback(
    (gone: (row: VacancyRowData) => boolean) => {
      const idx = displayRows.findIndex(gone)
      goneRef.current = new Set([...goneRef.current, ...displayRows.filter(gone).map((r) => r.id)])
      const stays = (r: VacancyRowData) => !gone(r) && !goneRef.current.has(r.id)
      const next =
        displayRows.slice(idx + 1).find(stays) ??
        displayRows.slice(0, Math.max(idx, 0)).reverse().find(stays) ??
        null
      if (next) {
        selectRow(next.id)
      } else {
        setSelectedId(null)
        setPageView(null)
      }
    },
    [displayRows, selectRow],
  )

  const handleActionRef = useRef<(key: string) => void>(() => {})

  async function handleUndoDecision() {
    if (!pageView || profile === null) return
    const decision = sessionDecisions.get(pageView.id)
    if (!decision) return
    const id = decision.row.id
    const back = pageView.actions?.find((a) => a.key === 'inbox' || a.key === 'restore')
    retract('vacancy-action')
    try {
      const { counts: newCounts } = await postDecision(id, {
        profile,
        from: decision.to,
        to: back?.to ?? decision.from,
        reason: '',
        confirmed: false,
      })
      onCounts?.(newCounts)
      if (!rows.some((r) => r.id === id)) {
        setReturnedRows((prev) => new Map(prev).set(id, { row: decision.row, idx: decision.idx }))
      }
      setSessionDecisions((prev) => {
        const next = new Map(prev)
        next.delete(id)
        return next
      })
      if (selectedIdRef.current === id) openRow(id)
    } catch (err) {
      announce(failure(err instanceof ServerError ? err : null, 'Could not undo decision'), 'vacancy-action')
    }
  }

  async function handleAction(key: string) {
    if (!pageView || profile === null) return
    retract('vacancy-action')

    if (key === 'block') {
      try {
        await addExclusion('company', pageView.company)
        setBlockCount((n) => n + 1)
        selectAfterRemoval((r) => r.company === pageView.company)
      } catch (err) {
        announce(failure(err instanceof ServerError ? err : null, 'Could not block company'), 'vacancy-action')
      }
      return
    }

    const action = pageView.actions?.find((a) => a.key === key)
    if (!action) return

    if (key === 'apply') {
      let note: string | null = null
      if (!action.url) {
        note = action.message ?? 'No valid employer or original listing URL is available. The role stays in Shortlist.'
      } else {
        const opened = window.open(action.url, '_blank', 'noopener')
        if (!opened) {
          note = 'The application page was blocked. Allow popups and try Apply again. The role stays in Shortlist.'
        }
      }
      setApplyDialogSaving(false)
      setApplyDialogNote(null)
      setActiveDialog({ kind: 'apply', title: pageView.title, company: pageView.company, note, outcomes: action.outcomes ?? [] })
      return
    }

    if (action.confirm === 'outcome') {
      setApplyDialogSaving(false)
      setApplyDialogNote(null)
      setActiveDialog({ kind: 'apply', title: pageView.title, company: pageView.company, note: null, outcomes: action.outcomes ?? [] })
      return
    }

    if (action.confirm === 'delete') {
      setDeleteDialogSaving(false)
      setDeleteDialogNote(null)
      setActiveDialog({ kind: 'delete', title: pageView.title, company: pageView.company })
      return
    }

    if (!action.to) return
    const from = pageView.stage
    const to = action.to

    try {
      const { counts: newCounts } = await postDecision(pageView.id, { profile, from, to, reason: '', confirmed: false })
      onCounts?.(newCounts)

      if (pageView.stage === 'inbox' && (to === 'shortlist' || to === 'dismissed')) {
        const originalRow = rows.find((r) => r.id === pageView.id) ?? {
          id: pageView.id,
          company: pageView.company,
          title: pageView.title,
          location: pageView.location,
          locationFull: pageView.locationFull,
          published: pageView.published,
          unread: pageView.unread,
          stage: pageView.stage,
          fit: pageView.fit,
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
        setSessionDecisions((prev) => {
          const next = new Map(prev)
          next.delete(pageView.id)
          return next
        })
        setBlockCount((n) => n + 1)
        selectAfterRemoval((r) => r.id === pageView.id)
      }
    } catch (err) {
      announce(failure(err instanceof ServerError ? err : null, 'Could not save decision'), 'vacancy-action')
    }
  }

  async function handleApplyOutcome(outcome: Outcome) {
    if (!pageView || profile === null) return
    if (!outcome.to) {
      setActiveDialog({ kind: 'none' })
      return
    }
    setApplyDialogSaving(true)
    setApplyDialogNote(null)
    try {
      const { counts: newCounts } = await postDecision(pageView.id, {
        profile,
        from: pageView.stage,
        to: outcome.to,
        reason: outcome.reason ?? '',
        confirmed: outcome.confirmed ?? false,
      })
      onCounts?.(newCounts)
      setActiveDialog({ kind: 'none' })
      setBlockCount((n) => n + 1)
      selectAfterRemoval((r) => r.id === pageView.id)
    } catch (err) {
      setApplyDialogSaving(false)
      setApplyDialogNote(failure(err instanceof ServerError ? err : null, 'Could not save outcome'))
    }
  }

  async function handleDeleteConfirm() {
    if (!pageView || profile === null) return
    setDeleteDialogSaving(true)
    setDeleteDialogNote(null)
    try {
      const { counts: newCounts } = await deleteVacancy(pageView.id, profile)
      onCounts?.(newCounts)
      setActiveDialog({ kind: 'none' })
      setBlockCount((n) => n + 1)
      selectAfterRemoval((r) => r.id === pageView.id)
    } catch (err) {
      setDeleteDialogSaving(false)
      setDeleteDialogNote(failure(err instanceof ServerError ? err : null, 'Could not delete role'))
    }
  }

  handleActionRef.current = (key) => void handleAction(key)

  async function handleSkillDecision(answer: SkillAnswer): Promise<void> {
    if (!pageView) return
    retract('vacancy-action')
    try {
      const { vacancyView } = await postSkillsDecision({
        ...answer,
        vacancyId: pageView.id,
      })
      setPageView(vacancyView)
      setRowFitUpdates((prev) => {
        const next = new Map(prev)
        next.set(vacancyView.id, vacancyView.fit)
        return next
      })
    } catch (err) {
      announce(failure(err instanceof ServerError ? err : null, 'Could not save your skill'), 'vacancy-action')
    }
  }

  async function handleLocate(): Promise<void> {
    if (!pageView || profile === null) return
    retract('vacancy-action')
    try {
      setPageView(await postLocate(pageView.id, profile))
    } catch (err) {
      announce(failure(err instanceof ServerError ? err : null, 'Could not start the search'), 'vacancy-action')
    }
  }

  async function handleCheckRetry(): Promise<void> {
    if (!pageView || profile === null) return
    retract('vacancy-action')
    try {
      setPageView(await postShortlistCheckRetry(pageView.id, profile))
    } catch (err) {
      announce(failure(err instanceof ServerError ? err : null, 'Could not retry the check'), 'vacancy-action')
    }
  }

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

  useEffect(() => {
    return installActionShortcuts((code) => {
      if (dialogOpen || (settingsOpen ?? false) || !pageView) return false
      if (sessionDecisions.get(pageView.id) != null) return false
      const key = Object.keys(ACTIONS).find((k) => ACTIONS[k].code === code)
      if (!key || !pageView.actions?.some((a) => a.key === key)) return false
      handleActionRef.current(key)
      return true
    })
  }, [pageView, sessionDecisions, dialogOpen, settingsOpen])

  const isArchive = mainTab === 'archive'

  return (
    <div className="workspace" style={{ '--list-w': `${listWidth}px` } as React.CSSProperties}>
      <aside className="catalogue" aria-label="Vacancies">
        <ListResizer width={listWidth} onChange={setListWidth} />
        <SearchField value={query} onChange={setQuery} />
        <div className="list-toolbar">
          {!isArchive && (
            <button aria-pressed={unread} onClick={() => setUnread(!unread)}>
              Unread
            </button>
          )}
          <div className="filter-box">
            <button
              aria-expanded={panelOpen}
              onClick={() => setPanelOpen((p) => !p)}
            >
              <Icon name="filters" size={14} />
              Filters
              {activeFilterCount > 0 && (
                <span className="filter-count">{activeFilterCount}</span>
              )}
            </button>
            {panelOpen && (
              <FilterPanel
                filters={filters}
                allSources={allSources}
                sourceCounts={sourceCounts}
                rowCount={matching}
                total={total}
                onChange={setFilters}
                onReset={() => { resetAll(); setPanelOpen(false) }}
                onClose={() => setPanelOpen(false)}
              />
            )}
          </div>
          {!isArchive && (
            <div className="sort-toggle" role="group" aria-label="Sort roles">
              <button aria-pressed={sort === 'fit'} onClick={() => setSort('fit')}>Best fit</button>
              <button aria-pressed={sort === 'newest'} onClick={() => setSort('newest')}>Newest</button>
            </div>
          )}
        </div>
        {unread && !isArchive && (
          <p className="unread-note">Opening marks a role read. It stays here until you choose another role.</p>
        )}
        {isArchive && (
          <div className="archive-tabs">
            <button
              className={archiveTab === 'applied' ? 'active' : undefined}
              aria-pressed={archiveTab === 'applied'}
              onClick={() => onArchiveTab?.('applied')}
            >
              Applied
            </button>
            <button
              className={archiveTab === 'dismissed' ? 'active' : undefined}
              aria-pressed={archiveTab === 'dismissed'}
              onClick={() => onArchiveTab?.('dismissed')}
            >
              Dismissed
            </button>
          </div>
        )}

        <div className="job-list">
          {loading ? null : displayRows.length === 0 ? (
            <div className="empty">
              <p>{listNote ? listNote.text : empty}</p>
              {!listNote && (query.trim() !== '' || activeFilterCount > 0 || unread) && (
                <button onClick={resetAll}>Reset filters</button>
              )}
            </div>
          ) : (
            displayRows.map((row) => {
              const fitOverride = rowFitUpdates.get(row.id)
              const displayRow = fitOverride ? { ...row, fit: fitOverride } : row
              return (
                <VacancyRow
                  key={row.id}
                  row={{ ...displayRow, unread: row.unread && !seenInSession.has(row.id) }}
                  selected={row.id === selectedId}
                  onSelect={() => selectRow(row.id)}
                  decidedTo={sessionDecisions.get(row.id)?.to ?? null}
                />
              )
            })
          )}
          {!loading && !listNote && hasMore && (
            <div className="list-more">
              <button type="button" disabled={loadingMore} onClick={() => loadMore(gone)}>
                Show more roles
              </button>
            </div>
          )}
        </div>

        {!loading && dismissedThisSession > 0 && (
          <p className="session-note">
            {dismissedThisSession} dismissed this session — they disappear next time.
          </p>
        )}
      </aside>

      <main className="detail" aria-label="Selected vacancy">
        <div className="detail-inner">
          <Refusal note={listNote} />

          {pageError ? (
            <Refusal note={pageError} />
          ) : pageView ? (
            <VacancyPage
              view={pageView}
              sessionDecision={sessionDecisions.get(pageView.id) ?? null}
              onAction={(key) => void handleAction(key)}
              onUndoDecision={() => void handleUndoDecision()}
              onSkillDecision={handleSkillDecision}
              onCheckRetry={handleCheckRetry}
              onLocate={handleLocate}
            />
          ) : loading || listNote ? null : (
            <div className="empty">
              <h1>No roles</h1>
              <p>This stage has no visible roles. Change stage or filters, or collect jobs in Sources.</p>
            </div>
          )}
        </div>
      </main>

      {activeDialog.kind === 'apply' && (
        <ApplyOutcomeDialog
          title={activeDialog.title}
          company={activeDialog.company}
          note={activeDialog.note}
          outcomes={activeDialog.outcomes}
          saving={applyDialogSaving}
          message={applyDialogNote}
          onDecide={(outcome) => void handleApplyOutcome(outcome)}
        />
      )}
      {activeDialog.kind === 'delete' && (
        <DeleteConfirmDialog
          title={activeDialog.title}
          company={activeDialog.company}
          saving={deleteDialogSaving}
          message={deleteDialogNote}
          onKeep={() => setActiveDialog({ kind: 'none' })}
          onDelete={() => void handleDeleteConfirm()}
        />
      )}
    </div>
  )
}
