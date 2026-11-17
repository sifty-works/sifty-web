import { useCallback, useEffect, useState } from 'react'
import { triggerCollect } from '../api/client.ts'
import { useStatus } from '../state/status.ts'
import { InboxList } from './InboxList.tsx'
import { SourcesPage } from './SourcesPage.tsx'

type Page = 'inbox' | 'settings'

export function Shell() {
  const [page, setPage] = useState<Page>('inbox')
  const [reloadCount, setReloadCount] = useState(0)

  const handleCatalogueChange = useCallback(() => setReloadCount((n) => n + 1), [])
  const { state: statusState, applyStatus } = useStatus(handleCatalogueChange)
  const status = statusState.status === 'ok' ? statusState.data : null

  // Start a scheduled collect run on page load; push the returned status so
  // the collecting indicator appears without waiting for the first poll.
  useEffect(() => {
    void triggerCollect(false).then(applyStatus).catch(() => {})
  }, [applyStatus])

  const headerText =
    status?.collecting?.text ??
    (status?.lastRun?.state === 'failed' ? status.lastRun.message : null)

  return (
    <div className="shell">
      <header className="shell-header">
        <h1 className="shell-title">Sifty</h1>
        {headerText && <span className="shell-status">{headerText}</span>}
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
      <div className="shell-body">
        {page === 'inbox' ? (
          <InboxList reloadTrigger={reloadCount} />
        ) : (
          <SourcesPage status={status} applyStatus={applyStatus} statusText={headerText} />
        )}
      </div>
    </div>
  )
}
