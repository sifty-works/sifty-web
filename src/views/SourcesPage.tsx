import { useEffect, useState } from 'react'
import { previewExclusion, Source, StatusExtra, triggerCollect, WorkResponse } from '../api/client.ts'
import { useExclusions } from '../state/exclusions.ts'
import { useSources } from '../state/sources.ts'
import { type UseRemoteResult } from '../state/work.ts'
import { failure, type Note } from '../state/messages.ts'
import { Message } from './Messages.tsx'
import { LogsPanel } from './LogsPanel.tsx'
import { ModelsPanel } from './ModelsPanel.tsx'
import { OfflineNotice } from './OfflineNotice.tsx'
import { WorkPanel } from './WorkPanel.tsx'

interface Props {
  startPanel?: string
  opened: number
  status: StatusExtra | null
  applyStatus: (data: StatusExtra) => void
  statusText: string | null
  work: UseRemoteResult<WorkResponse>
}

const INTERVAL_OPTIONS = [
  { label: '15 minutes', value: '15m' },
  { label: '30 minutes', value: '30m' },
  { label: '1 hour', value: '1h' },
  { label: '3 hours', value: '3h' },
  { label: '6 hours', value: '6h' },
  { label: '12 hours', value: '12h' },
  { label: '1 day', value: '24h' },
  { label: '7 days', value: '168h' },
]

const COLLECTION_ICON = <path d="M3 5h18M6 12h12M10 19h4" />

const MODELS_ICON = (
  <>
    <rect x="6" y="6" width="12" height="12" rx="2" />
    <path d="M9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3" />
  </>
)

const MONITOR_ICON = <path d="M3 12h4l3-7 4 14 3-7h4" />

export function SourcesPage({ startPanel, opened, status, applyStatus, statusText, work }: Props) {
  const { state, add, toggle, remove, updateSchedule, setAgeLimit, addNote } = useSources()
  const [nameVal, setNameVal] = useState('')
  const [urlVal, setUrlVal] = useState('')
  const [busy, setBusy] = useState(false)
  const [nav, setNav] = useState(startPanel ?? 'sources')
  const [collectNote, setCollectNote] = useState<Note | null>(null)
  const [ageDraft, setAgeDraft] = useState<string | null>(null)
  const [ageNote, setAgeNote] = useState<Note | null>(null)

  const isCollecting = status?.collecting != null

  useEffect(() => {
    if (startPanel) setNav(startPanel)
  }, [startPanel, opened])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    const ok = await add(nameVal.trim(), urlVal.trim())
    setBusy(false)
    if (ok) {
      setNameVal('')
      setUrlVal('')
    }
  }

  async function saveAge(e: React.FormEvent) {
    e.preventDefault()
    setAgeNote(null)
    const text = (ageDraft ?? '').trim()
    const note = await setAgeLimit(text === '' ? null : Number(text))
    setAgeNote(note)
    if (!note) setAgeDraft(null)
  }

  function collect() {
    setCollectNote(null)
    triggerCollect(true).then(applyStatus).catch((e: unknown) => setCollectNote(failure(e, 'Could not start collection')))
  }

  const sources = state.status === 'ok' ? state.sources : []
  const auto = state.status === 'ok' ? state.auto : false
  const interval = state.status === 'ok' ? state.interval : '3h'
  const storedAge = state.status === 'ok' && state.maxAgeMonths !== null ? String(state.maxAgeMonths) : ''

  const intervalOpts = INTERVAL_OPTIONS.some((o) => o.value === interval)
    ? INTERVAL_OPTIONS
    : [...INTERVAL_OPTIONS, { label: interval, value: interval }]

  const groups = [
    {
      title: 'Collection',
      icon: COLLECTION_ICON,
      panels: [
        {
          id: 'sources',
          label: 'Sources',
          body:
            state.status === 'error' ? (
              <p className="muted">{state.message}</p>
            ) : (
              <SourcesPanel
                sources={sources}
                auto={auto}
                interval={interval}
                intervalOpts={intervalOpts}
                busy={busy}
                isCollecting={isCollecting}
                statusText={statusText}
                nameVal={nameVal}
                urlVal={urlVal}
                addNote={addNote}
                collectNote={collectNote}
                ageVal={ageDraft ?? storedAge}
                ageSaved={ageDraft === null}
                ageNote={ageNote}
                onAgeChange={setAgeDraft}
                onAgeSave={(e) => void saveAge(e)}
                onToggle={(key, enabled) => void toggle(key, enabled)}
                onRemove={(key) => void remove(key)}
                onAdd={(e) => void handleAdd(e)}
                onNameChange={setNameVal}
                onUrlChange={setUrlVal}
                onUpdateSchedule={(a, i) => void updateSchedule(a, i)}
                onCollect={collect}
              />
            ),
        },
        { id: 'exclusions', label: 'Exclusions', body: <ExclusionsPanel /> },
      ],
    },
    {
      title: 'Models',
      icon: MODELS_ICON,
      panels: [
        { id: 'models', label: 'Models', body: <ModelsPanel /> },
      ],
    },
    {
      title: 'Monitor',
      icon: MONITOR_ICON,
      panels: [
        { id: 'monitor', label: 'Background work', body: <WorkPanel work={work} /> },
        { id: 'logs', label: 'Logs', body: <LogsPanel /> },
      ],
    },
  ]
  const panels = groups.flatMap((g) => g.panels)
  const active = panels.find((p) => p.id === nav) ?? panels[0]

  return (
    <div className="settings-page">
      <nav className="settings-nav" aria-label="Settings sections">
        {groups.map((g) => (
          <div className="settings-group" key={g.title}>
            <h2>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                {g.icon}
              </svg>
              {g.title}
            </h2>
            <div className="settings-group-items">
              {g.panels.map((p) => (
                <button
                  key={p.id}
                  className={active.id === p.id ? 'active' : undefined}
                  aria-current={active.id === p.id ? 'page' : undefined}
                  onClick={() => setNav(p.id)}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="settings-main">
        <div className="settings-content">
          {state.status === 'offline' ? <OfflineNotice /> : active.body}
        </div>
      </div>
    </div>
  )
}

interface SourcesPanelProps {
  sources: Source[]
  auto: boolean
  interval: string
  intervalOpts: { label: string; value: string }[]
  busy: boolean
  isCollecting: boolean
  statusText: string | null
  nameVal: string
  urlVal: string
  addNote: Note | null
  collectNote: Note | null
  ageVal: string
  ageSaved: boolean
  ageNote: Note | null
  onAgeChange: (v: string) => void
  onAgeSave: (e: React.FormEvent) => void
  onToggle: (key: string, enabled: boolean) => void
  onRemove: (key: string) => void
  onAdd: (e: React.FormEvent) => void
  onNameChange: (v: string) => void
  onUrlChange: (v: string) => void
  onUpdateSchedule: (auto: boolean, interval: string) => void
  onCollect: () => void
}

function SourcesPanel({
  sources, auto, interval, intervalOpts, busy, isCollecting, statusText,
  nameVal, urlVal, addNote, collectNote, ageVal, ageSaved, ageNote, onAgeChange, onAgeSave,
  onToggle, onRemove, onAdd, onNameChange, onUrlChange, onUpdateSchedule, onCollect,
}: SourcesPanelProps) {
  return (
    <>
      <h1>Source sites</h1>
      <p className="lead">Sites are searched during collection. Disable a site to pause it without removing it.</p>

      {sources.length > 0 && (
        <table className="sites-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>URL</th>
              <th>Status</th>
              <th>Enabled</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {sources.map((s) => (
              <tr key={s.key}>
                <td>{s.name || <span className="muted">—</span>}</td>
                <td>
                  {s.url
                    ? <a href={s.url} target="_blank" rel="noreferrer" className="site-url">{s.url}</a>
                    : <span className="muted">—</span>}
                </td>
                <td>
                  {s.status && (
                    <span
                      className="site-url"
                      style={s.status.attention ? { color: '#a26a00' } : undefined}
                    >
                      {s.status.attention && '⚠ '}{s.status.text}
                    </span>
                  )}
                </td>
                <td>
                  <button
                    type="button"
                    role="switch"
                    className="s-switch"
                    aria-checked={s.enabled}
                    aria-label={`${s.name || s.url} enabled`}
                    disabled={busy}
                    onClick={() => onToggle(s.key, !s.enabled)}
                  >
                    <span className="s-track" aria-hidden="true"><span /></span>
                  </button>
                </td>
                <td>
                  <button disabled={busy} onClick={() => onRemove(s.key)}>Remove</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {sources.length === 0 && <p className="muted">No sites configured yet.</p>}

      <form className="sites-add-form" onSubmit={onAdd}>
        <label htmlFor="site-name">
          Site name
          <input
            id="site-name"
            value={nameVal}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="e.g. LinkedIn"
          />
        </label>
        <label htmlFor="site-url">
          URL (optional)
          <input
            id="site-url"
            value={urlVal}
            onChange={(e) => onUrlChange(e.target.value)}
            placeholder="https://…"
          />
        </label>
        <button className="primary" type="submit" disabled={busy || (!nameVal.trim() && !urlVal.trim())}>
          Add site
        </button>
        <Message note={addNote} />
      </form>

      <section className="s-card" style={{ marginTop: 14 }}>
        <div className="s-switch-row">
          <button
            type="button"
            role="switch"
            className="s-switch"
            aria-checked={auto}
            disabled={busy}
            onClick={() => onUpdateSchedule(!auto, interval)}
          >
            <span className="s-track" aria-hidden="true"><span /></span>
            Collect automatically
          </button>
        </div>
        {auto && (
          <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>Every</span>
            <select
              value={interval}
              disabled={busy}
              onChange={(e) => onUpdateSchedule(auto, e.target.value)}
            >
              {intervalOpts.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        )}
        <form onSubmit={onAgeSave} style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <label htmlFor="max-age-months">Do not collect roles published more than</label>
          <input
            id="max-age-months"
            type="number"
            style={{ width: 80 }}
            value={ageVal}
            placeholder="no limit"
            onChange={(e) => onAgeChange(e.target.value)}
          />
          <span>months ago</span>
          <button type="submit" disabled={busy || ageSaved}>Save</button>
        </form>
        <Message note={ageNote} />
        <div style={{ marginTop: 14 }}>
          <button className="primary" disabled={isCollecting} onClick={onCollect}>
            Collect jobs
          </button>
          {statusText && <span className="muted" style={{ marginLeft: 10 }}>{statusText}</span>}
        </div>
        <Message note={collectNote} />
      </section>
    </>
  )
}

function ExclusionsPanel() {
  const { state, add, remove, note } = useExclusions()
  const [kind, setKind] = useState<'word' | 'company'>('word')
  const [value, setValue] = useState('')
  const [preview, setPreview] = useState('')

  useEffect(() => {
    const trimmed = value.trim()
    if (!trimmed) { setPreview(''); return }
    let cancelled = false
    previewExclusion(kind, trimmed)
      .then((d) => { if (!cancelled) setPreview(d.text) })
      .catch(() => { if (!cancelled) setPreview('') })
    return () => { cancelled = true }
  }, [kind, value])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    const ok = await add(kind, value.trim())
    if (ok) { setValue(''); setPreview('') }
  }

  const exclusions = state.status === 'ok' ? state.exclusions : []

  return (
    <>
      <h1>Exclusions</h1>
      <p className="lead">Words and companies hidden in every list.</p>

      <form className="sites-add-form" onSubmit={(e) => void handleAdd(e)}>
        <select value={kind} onChange={(e) => setKind(e.target.value as 'word' | 'company')} aria-label="Kind">
          <option value="word">Word</option>
          <option value="company">Company</option>
        </select>
        <input
          type="text"
          placeholder={kind === 'word' ? 'Word or phrase in title or company' : 'Company name'}
          aria-label="Exclusion value"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          required
        />
        <button type="submit">Add</button>
        {preview && <p className="muted">{preview}</p>}
        <Message note={note} />
      </form>

      {exclusions.length > 0 && (
        <table className="sites-table" style={{ marginTop: 16 }}>
          <thead>
            <tr>
              <th>Kind</th>
              <th>Value</th>
              <th>Scope</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {exclusions.map((ex) => (
              <tr key={ex.id}>
                <td>{ex.kind}</td>
                <td>{ex.value}</td>
                <td>{ex.scope}</td>
                <td>
                  <button onClick={() => void remove(ex.id)}>Remove</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  )
}
