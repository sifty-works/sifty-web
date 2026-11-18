import { useCallback, useEffect, useRef, useState } from 'react'
import { triggerCollect, VacancyCounts } from '../api/client.ts'
import { useStatus } from '../state/status.ts'
import { Brand } from './Brand.tsx'
import { Icon } from './Icon.tsx'
import { InboxList } from './InboxList.tsx'
import { SourcesPage } from './SourcesPage.tsx'

type Page = 'inbox' | 'settings'
type MainTab = 'inbox' | 'shortlist' | 'archive'
type ArchiveTab = 'applied' | 'dismissed'

export function Shell() {
  const [page, setPage] = useState<Page>('inbox')
  const [reloadCount, setReloadCount] = useState(0)
  const [mainTab, setMainTab] = useState<MainTab>('inbox')
  const [archiveTab, setArchiveTab] = useState<ArchiveTab>('applied')
  const [counts, setCounts] = useState<VacancyCounts | null>(null)

  const stage = mainTab === 'archive' ? archiveTab : mainTab

  const handleCatalogueChange = useCallback(() => setReloadCount((n) => n + 1), [])
  const { state: statusState, applyStatus } = useStatus(handleCatalogueChange)
  const status = statusState.status === 'ok' ? statusState.data : null

  // Trigger a reload when the server comes back after being offline.
  const prevStatusRef = useRef<string>('unknown')
  useEffect(() => {
    if (prevStatusRef.current === 'offline' && statusState.status === 'ok') {
      setReloadCount((n) => n + 1)
    }
    prevStatusRef.current = statusState.status
  }, [statusState.status])

  function switchMainTab(tab: MainTab) {
    setMainTab(tab)
    if (tab === 'archive') setArchiveTab('applied')
  }

  useEffect(() => {
    void triggerCollect(false).then(applyStatus).catch(() => {})
  }, [applyStatus])

  const collecting = status?.collecting != null
  const headerText =
    status?.collecting?.text ??
    (status?.lastRun?.state === 'failed' ? status.lastRun.message : null)
  const attentionText = status?.attention?.text ?? null

  return (
    <div className="sift-app">
      {/*
       * theme.css overrides .app-header to display:grid with three columns:
       *   col 1 (.stages):         minmax(0,1fr)  — left, flex-start
       *   col 2 (.brand):          auto           — centre
       *   col 3 (.header-actions): minmax(0,1fr)  — right, flex-end
       * Use those classes and avoid adding extra children.
       */}
      <header className="app-header">
        {/* column 1 — stage tabs; clicking one from Settings returns to inbox */}
        <nav className="stages">
          {(['inbox', 'shortlist', 'archive'] as MainTab[]).map((t) => (
            <button
              key={t}
              className={mainTab === t && page === 'inbox' ? 'active' : undefined}
              onClick={() => { switchMainTab(t); setPage('inbox') }}
            >
              {t === 'inbox' ? 'Inbox' : t === 'shortlist' ? 'Shortlist' : 'Archive'}
              <span>
                {counts
                  ? (t === 'inbox'
                      ? counts.inbox
                      : t === 'shortlist'
                        ? counts.shortlist
                        : counts.archive)
                  : ''}
              </span>
            </button>
          ))}
        </nav>

        {/* column 2 — brand, centred by grid */}
        <Brand collecting={collecting} />

        {/* column 3 — settings / back, right-aligned */}
        <div className="header-actions">
          {headerText && (
            <span className="muted" style={{ fontSize: 12 }}>{headerText}</span>
          )}
          {attentionText && (
            <button
              className="settings-button"
              style={{ color: '#e0b45a', fontSize: 13 }}
              onClick={() => setPage('settings')}
            >
              {attentionText}
            </button>
          )}
          <button
            className={page === 'settings' ? 'settings-button active' : 'settings-button'}
            onClick={() => setPage(page === 'settings' ? 'inbox' : 'settings')}
          >
            <Icon name="settings" size={16} /> Settings
          </button>
        </div>
      </header>

      {page === 'inbox' ? (
        <InboxList
          key={stage}
          stage={stage}
          reloadTrigger={reloadCount}
          onCounts={setCounts}
          settingsOpen={false}
          mainTab={mainTab}
          archiveTab={archiveTab}
          onArchiveTab={(t) => setArchiveTab(t as ArchiveTab)}
        />
      ) : (
        <SourcesPage status={status} applyStatus={applyStatus} statusText={headerText} />
      )}
    </div>
  )
}
