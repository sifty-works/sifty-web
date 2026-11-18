import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  addExclusion,
  deleteVacancy,
  getVacancy,
  markSeen,
  OfflineError,
  Outcome,
  postDecision,
  ServerError,
  VacancyCounts,
  VacancyRow as VacancyRowData,
  VacancyView,
} from '../api/client.ts'
import { installActionShortcuts, installNavShortcuts } from '../keyboard.ts'
import { SessionDecision } from '../state/decisions.ts'
import { useVacancies } from '../state/vacancies.ts'
import { ApplyOutcomeDialog, DeleteConfirmDialog } from './Dialogs.tsx'
import { ListResizer, useListWidth } from './ListResizer.tsx'
import { SearchField } from './SearchField.tsx'
import { VacancyPage } from './VacancyPage.tsx'
import { VacancyRow } from './VacancyRow.tsx'

const SERVER_DOWN = 'Sifty server is not responding. Retrying…'

type ActiveDialog =
  | { kind: 'none' }
  | { kind: 'apply'; title: string; company: string; note: string | null; outcomes: Outcome[] }
  | { kind: 'delete'; title: string; company: string }

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
  settingsOpen?: boolean
  mainTab?: string
  archiveTab?: string
  onArchiveTab?: (tab: string) => void
}

export function InboxList({
  stage,
  reloadTrigger,
  onCounts,
  settingsOpen,
  mainTab,
  archiveTab,
  onArchiveTab,
}: Props) {
  const [blockCount, setBlockCount] = useState(0)
  const { state, query, setQuery, resetQuery } = useVacancies(
    stage,
    (reloadTrigger ?? 0) + blockCount,
  )

  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [seenInSession, setSeenInSession] = useState<ReadonlySet<number>>(new Set())
  const [pageView, setPageView] = useState<VacancyView | null>(null)
  const [pageError, setPageError] = useState<string | null>(null)
  const [listWidth, setListWidth] = useListWidth()
  const [sessionDecisions, setSessionDecisions] = useState<Map<number, SessionDecision>>(new Map())
  const [actionError, setActionError] = useState<string | null>(null)
  const [activeDialog, setActiveDialog] = useState<ActiveDialog>({ kind: 'none' })
  const [applyDialogSaving, setApplyDialogSaving] = useState(false)
  const [applyDialogError, setApplyDialogError] = useState<string | null>(null)
  const [deleteDialogSaving, setDeleteDialogSaving] = useState(false)
  const [deleteDialogError, setDeleteDialogError] = useState<string | null>(null)
  const [bannerDismissed, setBannerDismissed] = useState(false)

  const dialogOpen = activeDialog.kind !== 'none'
  const profile = state.status === 'ok' ? state.profile : null
  const rows = state.status === 'ok' ? state.rows : []
  const counts = state.status === 'ok' ? state.counts : null
  const empty = state.status === 'ok' ? state.empty : ''
  const loading = state.status === 'loading'
  const serverDown = state.status === 'offline'

  // Reset banner dismissed state when server comes back.
  useEffect(() => {
    if (state.status === 'ok') setBannerDismissed(false)
  }, [state.status])

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
    if (counts !== null) onCounts?.(counts)
  }, [counts, onCounts])

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

  const handleActionRef = useRef<(key: string, url?: string, message?: string) => void>(() => {})

  async function handleAction(key: string, _url?: string, _message?: string) {
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

    const action = pageView.actions?.find((a) => a.key === key)
    if (!action) return

    if (key === 'apply') {
      // Apply opens the employer URL in a new window (presentation), then shows the outcome dialog.
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
      setApplyDialogError(null)
      setActiveDialog({ kind: 'apply', title: pageView.title, company: pageView.company, note, outcomes: action.outcomes ?? [] })
      return
    }

    if (action.confirm === 'outcome') {
      // Opens the outcome dialog directly — no URL required.
      setApplyDialogSaving(false)
      setApplyDialogError(null)
      setActiveDialog({ kind: 'apply', title: pageView.title, company: pageView.company, note: null, outcomes: action.outcomes ?? [] })
      return
    }

    if (action.confirm === 'delete') {
      setDeleteDialogSaving(false)
      setDeleteDialogError(null)
      setActiveDialog({ kind: 'delete', title: pageView.title, company: pageView.company })
      return
    }

    // Direct stage move: to and from come from the action data.
    if (!action.to) return
    const from = pageView.stage
    const to = action.to

    try {
      const { counts: newCounts } = await postDecision(pageView.id, { profile, from, to, reason: '', confirmed: false })
      onCounts?.(newCounts)

      // When moving from inbox to shortlist or dismissed, inject the row into the
      // session list so it stays visible until reload.
      if (pageView.stage === 'inbox' && (to === 'shortlist' || to === 'dismissed')) {
        const originalRow = rows.find((r) => r.id === pageView.id) ?? {
          id: pageView.id,
          company: pageView.company,
          title: pageView.title,
          location: pageView.location,
          published: pageView.published,
          unread: pageView.unread,
          stage: pageView.stage,
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
        // Undo / return to inbox / restore: row moves back; remove from session list and reload.
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

  async function handleApplyOutcome(outcome: Outcome) {
    if (!pageView || profile === null) return
    if (!outcome.to) {
      // "Not yet" and any outcome without a stage — just close the dialog.
      setActiveDialog({ kind: 'none' })
      return
    }
    setApplyDialogSaving(true)
    setApplyDialogError(null)
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
  // Only act when the matching action is present in pageView.actions.
  useEffect(() => {
    return installActionShortcuts(
      () => {
        if (stage === 'inbox' && selectedId !== null && pageView?.actions?.some((a) => a.key === 'select'))
          handleActionRef.current('select')
      },
      () => {
        if (stage === 'inbox' && selectedId !== null && pageView?.actions?.some((a) => a.key === 'dismiss'))
          handleActionRef.current('dismiss')
      },
      () => {
        if (stage === 'shortlist' && selectedId !== null && pageView) {
          const a = pageView.actions?.find((x) => x.key === 'apply')
          if (a) handleActionRef.current('apply', a.url, a.message)
        }
      },
      () => dialogOpen || (settingsOpen ?? false),
    )
  }, [stage, selectedId, pageView, dialogOpen, settingsOpen])

  const isArchive = mainTab === 'archive'

  return (
    <div className="workspace" style={{ '--list-w': `${listWidth}px` } as React.CSSProperties}>
      <aside className="catalogue" aria-label="Vacancies">
        <ListResizer width={listWidth} onChange={setListWidth} />
        <SearchField value={query} onChange={setQuery} />
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
              <p>{serverDown ? SERVER_DOWN : empty}</p>
              {!serverDown && query.trim() !== '' && (
                <button onClick={resetQuery}>Reset filters</button>
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

        {!loading && dismissedThisSession > 0 && (
          <p className="session-note">
            {dismissedThisSession} dismissed this session — they disappear next time.
          </p>
        )}
      </aside>

      <main className="detail" aria-label="Selected vacancy">
        <div className="detail-inner">
          {serverDown && !bannerDismissed && (
            <div className="banner error" data-kind="retry" role="alert">
              {SERVER_DOWN}
              <button aria-label="Dismiss" onClick={() => setBannerDismissed(true)}>×</button>
            </div>
          )}

          {pageError ? (
            <div className="banner error" data-kind="retry" role="alert">{pageError}</div>
          ) : pageView ? (
            <VacancyPage
              view={pageView}
              sessionDecision={sessionDecisions.get(pageView.id) ?? null}
              actionError={actionError}
              onAction={(key, url, message) => void handleAction(key, url, message)}
            />
          ) : (
            <div className="empty">
              <h1>{displayRows.length ? 'Select a role' : 'No role selected'}</h1>
              <p>
                {displayRows.length
                  ? 'Choose a role to review its evidence.'
                  : 'This stage has no visible roles. Change stage or filters, or collect jobs in Sources.'}
              </p>
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
          error={applyDialogError}
          onDecide={(outcome) => void handleApplyOutcome(outcome)}
        />
      )}
      {activeDialog.kind === 'delete' && (
        <DeleteConfirmDialog
          title={activeDialog.title}
          company={activeDialog.company}
          saving={deleteDialogSaving}
          error={deleteDialogError}
          onKeep={() => setActiveDialog({ kind: 'none' })}
          onDelete={() => void handleDeleteConfirm()}
        />
      )}
    </div>
  )
}
