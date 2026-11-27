import { useCallback, useEffect, useRef, useState } from 'react'
import { triggerCollect, VacancyCounts } from '../api/client.ts'
import { silent } from '../state/messages.ts'
import { useStatus } from '../state/status.ts'
import { useWork } from '../state/work.ts'
import { Brand } from './Brand.tsx'
import { FilesTab } from './FilesPanel.tsx'
import { Icon } from './Icon.tsx'
import { InboxList } from './InboxList.tsx'
import { ProfilePage } from './ProfilePage.tsx'
import { ProfileTab } from './ProfileSearch.tsx'
import { ProfileSwitcher } from './ProfileSwitcher.tsx'
import { SourcesPage } from './SourcesPage.tsx'
import { StatusBar } from './StatusBar.tsx'
import { Toasts } from './Toasts.tsx'

type Page = 'inbox' | 'settings' | 'profile'
type MainTab = 'inbox' | 'shortlist' | 'archive'
type ArchiveTab = 'applied' | 'dismissed'

export function Shell() {
  const [page, setPage] = useState<Page>('inbox')
  const [profileId, setProfileId] = useState<number | null>(null)
  const [activeProfileId, setActiveProfileId] = useState<number | null>(null)
  const [reloadCount, setReloadCount] = useState(0)
  const [mainTab, setMainTab] = useState<MainTab>('inbox')
  const [archiveTab, setArchiveTab] = useState<ArchiveTab>('applied')
  const [counts, setCounts] = useState<VacancyCounts | null>(null)
  const [settingsPanel, setSettingsPanel] = useState<{ id?: string; opened: number }>({ opened: 0 })

  function openSettings(panel?: string) {
    setSettingsPanel((prev) => ({ id: panel, opened: prev.opened + 1 }))
    setPage('settings')
  }

  const stage = mainTab === 'archive' ? archiveTab : mainTab

  const handleCatalogueChange = useCallback(() => setReloadCount((n) => n + 1), [])
  const { state: statusState, recovered, applyStatus } = useStatus(handleCatalogueChange)
  const status = statusState.status === 'ok' ? statusState.data : null
  const work = useWork()

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
    void triggerCollect(false).then(applyStatus).catch(silent('automatic collection on start was not asked for by the user'))
  }, [applyStatus])

  const collecting = status?.collecting != null
  const modelJob = work.state.status === 'ok' ? work.state.data.running.find((r) => r.model) : undefined
  const collectText =
    status?.collecting?.text ??
    (status?.lastRun?.state === 'failed' ? status.lastRun.message : null)

  return (
    <div className="sift-app">
      <header className="app-header">
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

        <Brand busy={collecting ? 'Collecting jobs…' : modelJob ? `${modelJob.label}…` : null} />

        <div className="header-actions">
          <ProfileSwitcher
            profileOpen={page === 'profile'}
            onOpenProfile={(id) => { setProfileId(id); setPage('profile') }}
            onSwitch={(id) => { setActiveProfileId(id); setReloadCount((n) => n + 1) }}
          />
          <button
            className={page === 'settings' ? 'settings-button active' : 'settings-button'}
            onClick={() => (page === 'settings' ? setPage('inbox') : openSettings())}
          >
            <Icon name="settings" size={16} /> Settings
          </button>
        </div>
      </header>

      {recovered.length > 0 && (
        <div className="app-recovered">
          {recovered.map((f) => (
            <p key={f.file}>{f.text}</p>
          ))}
        </div>
      )}

      {page === 'profile' && profileId !== null ? (
        <ProfilePage
          profileId={profileId}
          onClose={() => setPage('inbox')}
          onOpenSettings={() => openSettings('models')}
          profileTab={ProfileTab}
          filesTab={FilesTab}
        />
      ) : page === 'inbox' ? (
        <InboxList
          key={stage}
          stage={stage}
          reloadTrigger={reloadCount}
          onCounts={setCounts}
          settingsOpen={false}
          mainTab={mainTab}
          archiveTab={archiveTab}
          onArchiveTab={(t) => setArchiveTab(t as ArchiveTab)}
          profile={activeProfileId}
        />
      ) : (
        <SourcesPage
          startPanel={settingsPanel.id}
          opened={settingsPanel.opened}
          status={status}
          applyStatus={applyStatus}
          statusText={collectText}
          work={work}
        />
      )}

      <StatusBar key={`status-${page}`} status={statusState} work={work.state} newToday={counts?.newToday ?? null} onOpen={openSettings} />
      <Toasts />
    </div>
  )
}
