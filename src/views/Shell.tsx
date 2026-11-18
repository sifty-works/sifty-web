import { useCallback, useEffect, useState } from 'react'
import { triggerCollect, VacancyCounts } from '../api/client.ts'
import { useStatus } from '../state/status.ts'
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

  function switchMainTab(tab: MainTab) {
    setMainTab(tab)
    if (tab === 'archive') setArchiveTab('applied')
  }

  useEffect(() => {
    void triggerCollect(false).then(applyStatus).catch(() => {})
  }, [applyStatus])

  const headerText =
    status?.collecting?.text ??
    (status?.lastRun?.state === 'failed' ? status.lastRun.message : null)
  const attentionText = status?.attention?.text ?? null

  function tabLabel(tab: MainTab): string {
    if (tab === 'inbox') return counts ? `Inbox ${counts.inbox}` : 'Inbox'
    if (tab === 'shortlist') return counts ? `Shortlist ${counts.shortlist}` : 'Shortlist'
    return counts ? `Archive ${counts.archive}` : 'Archive'
  }

  return (
    <div className="shell">
      <header className="shell-header">
        <h1 className="shell-title">Sifty</h1>
        {page === 'inbox' && (
          <nav className="stage-tabs">
            {(['inbox', 'shortlist', 'archive'] as MainTab[]).map((t) => (
              <button
                key={t}
                className={`stage-tab${mainTab === t ? ' stage-tab--active' : ''}`}
                onClick={() => switchMainTab(t)}
              >
                {tabLabel(t)}
              </button>
            ))}
          </nav>
        )}
        {headerText && <span className="shell-status">{headerText}</span>}
        {attentionText && (
          <button
            className="shell-status shell-attention"
            onClick={() => setPage('settings')}
          >
            {attentionText}
          </button>
        )}
        <div className="shell-nav">
          {page === 'inbox' ? (
            <button className="shell-nav-btn" onClick={() => setPage('settings')}>
              Settings
            </button>
          ) : (
            <button className="shell-nav-btn" onClick={() => setPage('inbox')}>
              Back to Inbox
            </button>
          )}
        </div>
      </header>
      {page === 'inbox' && mainTab === 'archive' && (
        <div className="stage-subtabs">
          <button
            className={`stage-subtab${archiveTab === 'applied' ? ' stage-subtab--active' : ''}`}
            onClick={() => setArchiveTab('applied')}
          >
            Applied
          </button>
          <button
            className={`stage-subtab${archiveTab === 'dismissed' ? ' stage-subtab--active' : ''}`}
            onClick={() => setArchiveTab('dismissed')}
          >
            Dismissed
          </button>
        </div>
      )}
      <div className="shell-body">
        {page === 'inbox' ? (
          <InboxList
            key={stage}
            stage={stage}
            reloadTrigger={reloadCount}
            onCounts={setCounts}
          />
        ) : (
          <SourcesPage status={status} applyStatus={applyStatus} statusText={headerText} />
        )}
      </div>
    </div>
  )
}
