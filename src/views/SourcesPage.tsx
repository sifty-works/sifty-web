import { useEffect, useState } from 'react'
import { previewExclusion, Source, StatusResponse, triggerCollect } from '../api/client.ts'
import { useExclusions } from '../state/exclusions.ts'
import { useSources } from '../state/sources.ts'
import { OfflineNotice } from './OfflineNotice.tsx'

type SettingsNav = 'sources' | 'exclusions'

interface Props {
  status: StatusResponse | null
  applyStatus: (data: StatusResponse) => void
  statusText: string | null
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

// Collection icon — three horizontal lines of decreasing width.
const COLLECTION_ICON = <path d="M3 5h18M6 12h12M10 19h4" />

export function SourcesPage({ status, applyStatus, statusText }: Props) {
  const { state, add, toggle, remove, updateSchedule, addError } = useSources()
  const [nameVal, setNameVal] = useState('')
  const [urlVal, setUrlVal] = useState('')
  const [busy, setBusy] = useState(false)
  const [nav, setNav] = useState<SettingsNav>('sources')

  const isCollecting = status?.collecting != null

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

  if (state.status === 'offline') return <OfflineNotice />

  if (state.status === 'error') {
    return (
      <div className="settings-page">
        <nav className="settings-nav" aria-label="Settings sections" />
        <div className="settings-main">
          <div className="settings-content">
            <p className="muted">{state.message}</p>
          </div>
        </div>
      </div>
    )
  }

  const sources = state.status === 'ok' ? state.sources : []
  const auto = state.status === 'ok' ? state.auto : false
  const interval = state.status === 'ok' ? state.interval : '3h'

  const intervalOpts = INTERVAL_OPTIONS.some((o) => o.value === interval)
    ? INTERVAL_OPTIONS
    : [...INTERVAL_OPTIONS, { label: interval, value: interval }]

  return (
    <div className="settings-page">
      <nav className="settings-nav" aria-label="Settings sections">
        <div className="settings-group">
          <h2>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {COLLECTION_ICON}
            </svg>
            Collection
          </h2>
          <div className="settings-group-items">
            <button
              className={nav === 'sources' ? 'active' : undefined}
              aria-current={nav === 'sources' ? 'page' : undefined}
              onClick={() => setNav('sources')}
            >
              Sources
            </button>
            <button
              className={nav === 'exclusions' ? 'active' : undefined}
              aria-current={nav === 'exclusions' ? 'page' : undefined}
              onClick={() => setNav('exclusions')}
            >
              Exclusions
            </button>
          </div>
        </div>
      </nav>

      <div className="settings-main">
        <div className="settings-content">
          {nav === 'sources' ? (
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
              addError={addError}
              onToggle={(key, enabled) => void toggle(key, enabled)}
              onRemove={(key) => void remove(key)}
              onAdd={(e) => void handleAdd(e)}
              onNameChange={setNameVal}
              onUrlChange={setUrlVal}
              onUpdateSchedule={(a, i) => void updateSchedule(a, i)}
              onCollect={() => void triggerCollect(true).then(applyStatus).catch(() => {})}
            />
          ) : (
            <ExclusionsPanel />
          )}
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
  addError: string | null
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
  nameVal, urlVal, addError,
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
        {addError && <p className="error">{addError}</p>}
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
        <div style={{ marginTop: 14 }}>
          <button className="primary" disabled={isCollecting} onClick={onCollect}>
            Collect jobs
          </button>
          {statusText && <span className="muted" style={{ marginLeft: 10 }}>{statusText}</span>}
        </div>
      </section>
    </>
  )
}

function ExclusionsPanel() {
  const { state, add, remove, addError } = useExclusions()
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
        {addError && <p className="error">{addError}</p>}
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
