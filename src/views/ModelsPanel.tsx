import { type FormEvent, type ReactNode, useEffect, useState } from 'react'
import { ModelsPatch, ModelsResponse, ProviderView, SecretView, WorkView } from '../api/client.ts'
import { type Note } from '../state/messages.ts'
import { useModels } from '../state/models.ts'
import { useSecrets } from '../state/secrets.ts'
import { Refusal } from './Refusal.tsx'

const WORK_NAMES: Record<string, string> = {
  reading: 'Reading',
  shortlist_check: 'Shortlist check',
  preparation: 'Preparation',
}

export function workName(kind: string): string {
  return WORK_NAMES[kind] ?? kind.charAt(0).toUpperCase() + kind.slice(1)
}

export function options(work: WorkView): string[] {
  return work.provider && !work.choices.includes(work.provider)
    ? [work.provider, ...work.choices]
    : work.choices
}

export function ModelsPanel() {
  const { state, save, check } = useModels()
  const secrets = useSecrets()
  const [checking, setChecking] = useState<string | null>(null)

  if (state.status === 'loading') return <p className="muted">Loading…</p>
  if (state.status === 'offline') {
    return <p className="muted">Sifty is not running. Start it and refresh the page.</p>
  }

  const models = state.models
  const names = models.providers.map((p) => p.name)
  const keyOf = (provider: string) => secrets.keys.find(
    (k) => names.find((n) => k.providers.includes(n)) === provider,
  )

  async function runCheck(name: string) {
    setChecking(name)
    await check(name)
    setChecking(null)
  }

  return (
    <>
      <h1>Models</h1>
      <p className="lead">Each kind of work uses the provider you choose. Nothing paid is used in bulk unless you allow it.</p>

      <section className="s-card">
        <h2>Work</h2>
        <table className="sites-table">
          <thead>
            <tr>
              <th>Work</th>
              <th>Provider</th>
            </tr>
          </thead>
          <tbody>
            {models.work.map((w) => (
              <tr key={w.kind}>
                <td>{workName(w.kind)}</td>
                <td>
                  <select
                    value={w.provider}
                    aria-label={`${workName(w.kind)} provider`}
                    onChange={(e) => void save({ work: { [w.kind]: e.target.value } })}
                  >
                    <option value="">Not chosen</option>
                    {options(w).map((name) => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="s-card">
        <h2>Providers</h2>
        {models.providers.length === 0
          ? <p className="muted">No providers configured yet.</p>
          : (
            <table className="sites-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Kind</th>
                  <th>Model</th>
                  <th>Cost</th>
                  <th>State</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {models.providers.map((p: ProviderView) => [
                  <tr key={p.name}>
                    <td>{p.name}</td>
                    <td>{p.kind}</td>
                    <td>{p.model || <span className="muted">—</span>}</td>
                    <td>{p.cost}</td>
                    <td>
                      {checking === p.name
                        ? <span className="muted">Checking…</span>
                        : p.state || <span className="muted">Not checked</span>}
                    </td>
                    <td>
                      <button disabled={checking === p.name} onClick={() => void runCheck(p.name)}>
                        Check
                      </button>
                    </td>
                  </tr>,
                  keyOf(p.name) && (
                    <tr key={`${p.name}-key`}>
                      <td colSpan={6} className="key-cell">
                        <KeyLine
                          view={keyOf(p.name)!}
                          provider={p.name}
                          onSave={secrets.save}
                          onRemove={secrets.remove}
                        />
                      </td>
                    </tr>
                  ),
                ])}
              </tbody>
            </table>
          )}
      </section>

      <BackgroundWork models={models} onSave={save} />
    </>
  )
}

interface KeyLineProps {
  view: SecretView
  provider: string
  onSave: (name: string, value: string) => Promise<Note | null>
  onRemove: (name: string) => Promise<Note | null>
}

function KeyLine({ view, provider, onSave, onRemove }: KeyLineProps) {
  const [mode, setMode] = useState<'shown' | 'replace' | 'remove'>('shown')
  const [value, setValue] = useState('')
  const [note, setNote] = useState<Note | null>(null)
  const [busy, setBusy] = useState(false)

  const others = view.providers.filter((n) => n !== provider)
  const typing = view.source !== 'environment' && (!view.set || mode === 'replace')

  async function run(call: () => Promise<Note | null>) {
    setBusy(true)
    setNote(null)
    setValue('')
    const answer = await call()
    setBusy(false)
    setNote(answer)
    if (answer === null) setMode('shown')
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    const typed = value
    if (typed.trim() === '') return
    void run(() => onSave(view.name, typed))
  }

  let line: ReactNode
  if (view.source === 'environment') {
    line = <span>From the environment</span>
  } else if (typing) {
    line = (
      <form className="key-line" onSubmit={submit}>
        <input
          type="password"
          autoComplete="off"
          value={value}
          placeholder={view.name}
          aria-label={`API key for ${provider}`}
          disabled={busy}
          onChange={(e) => setValue(e.target.value)}
        />
        <button type="submit" disabled={busy || value.trim() === ''}>Save</button>
        {view.set && (
          <button
            type="button"
            disabled={busy}
            onClick={() => { setValue(''); setNote(null); setMode('shown') }}
          >
            Cancel
          </button>
        )}
      </form>
    )
  } else if (mode === 'remove') {
    line = (
      <span className="key-line">
        <span>Remove this key?</span>
        <button disabled={busy} onClick={() => void run(() => onRemove(view.name))}>Remove</button>
        <button disabled={busy} onClick={() => setMode('shown')}>Cancel</button>
      </span>
    )
  } else {
    line = (
      <span className="key-line">
        <span>Key set{view.last4 && <> ••••{view.last4}</>}</span>
        <button onClick={() => { setNote(null); setMode('replace') }}>Replace</button>
        <button onClick={() => { setNote(null); setMode('remove') }}>Remove</button>
      </span>
    )
  }

  return (
    <>
      {line}
      {others.length > 0 && <p className="muted key-also">Also used by {others.join(', ')}</p>}
      <Refusal note={note} />
    </>
  )
}

interface BackgroundWorkProps {
  models: ModelsResponse
  onSave: (patch: ModelsPatch) => Promise<void>
}

function BackgroundWork({ models, onSave }: BackgroundWorkProps) {
  const [limit, setLimit] = useState(String(models.dailyLimit))

  useEffect(() => { setLimit(String(models.dailyLimit)) }, [models.dailyLimit])

  const readingName = models.work.find((w) => w.kind === 'reading')?.provider ?? ''
  const readingPaid = models.providers.some((p) => p.name === readingName && p.cost === 'paid')

  function commitLimit() {
    const text = limit.trim()
    const value = Number(text)
    if (text === '' || !Number.isInteger(value) || value < 0) {
      setLimit(String(models.dailyLimit))
      return
    }
    if (value !== models.dailyLimit) void onSave({ dailyLimit: value })
  }

  return (
    <section className="s-card">
      <h2>Background work</h2>
      <label className="s-switch-row">
        <input
          type="checkbox"
          checked={models.allowPaidBulk}
          onChange={(e) => void onSave({ allowPaidBulk: e.target.checked })}
        />
        Allow paid bulk work
      </label>
      <label className="s-switch-row" style={{ marginTop: 8 }}>
        <input
          type="checkbox"
          checked={models.preciseReading}
          disabled={readingName === ''}
          onChange={(e) => void onSave({ preciseReading: e.target.checked })}
        />
        Precise reading
      </label>
      <p className="muted" style={{ margin: '4px 0 0' }}>
        Reads every new vacancy's company with the Reading model; uses your local machine or a paid provider. Off: only vacancies you open are read.
      </p>
      {readingName === '' && <p className="muted" style={{ margin: '4px 0 0' }}>Choose a Reading model first</p>}
      {readingPaid && !models.allowPaidBulk && (
        <p className="muted" style={{ margin: '4px 0 0' }}>Needs Allow paid bulk work to read in the background.</p>
      )}
      <label className="s-switch-row" style={{ marginTop: 8 }}>
        <input
          type="checkbox"
          checked={models.paused}
          onChange={(e) => void onSave({ paused: e.target.checked })}
        />
        Pause all background work (collection, analysis and models; the Sifty switch in the status bar)
      </label>
      <label className="s-switch-row" style={{ marginTop: 12 }}>
        Daily limit of background model calls
        <input
          type="number"
          min={0}
          style={{ width: 90 }}
          value={limit}
          onChange={(e) => setLimit(e.target.value)}
          onBlur={commitLimit}
          onKeyDown={(e) => { if (e.key === 'Enter') commitLimit() }}
        />
        <span className="muted">0 means no limit</span>
      </label>
      <p className="muted" style={{ marginTop: 12, marginBottom: 0 }}>
        {models.todayCalls} background calls today
      </p>
    </section>
  )
}
